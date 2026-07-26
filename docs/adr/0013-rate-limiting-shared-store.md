# ADR-0013: Rate limiting by hashed IP, in a shared Postgres counter

- **Status:** Accepted
- **Date:** 2026-07-26
- **Deciders:** Repository owner
- **Relates to:** [ADR-0012](./0012-no-authentication-public-read-only.md) (no auth),
  [ADR-0006](./0006-hosting-tier-and-scheduled-jobs.md) (hosting deferred),
  [ADR-0011](./0011-third-party-api-compliance.md) (self-limiting is binding)

## Context

Removing authentication reopened a vulnerability the PRD had closed.

PRD review finding **M2** identified that per-user rate limiting is meaningless
for anonymous traffic, and the accepted fix was _"hiscores lookup requires
login"_. ADR-0012 deleted the login. **The fix is void**, and the exposure is no
longer an edge case — it applies to all traffic.

The concrete failure: any route that proxies an upstream on request is an open
proxy. A stranger points a loop at our public URL and we make the outbound
requests, from our IP, at their chosen rate. The realistic outcome is not a bill
— it is a quiet block by Jagex or the Wiki that breaks the app for the whole
clan, and a direct breach of the self-limiting commitment in
[`docs/api-terms.md`](../api-terms.md) (ADR-0011 §4).

Constraints that shaped the answer:

- **No user identity exists.** The only discriminator is the network address,
  which arrives in a client-writable header.
- **Hosting is undecided** (ADR-0006), so no Vercel-, Cloudflare- or
  Upstash-specific primitive may appear at a call site.
- **Serverless instances share no memory.** Any counter held in a process is
  per-instance, and N warm instances multiply the effective limit by N.
- **Postgres already exists**, and `job_state` set the precedent for a small
  operational table.
- Nothing proxies on demand _today_, so this ships before the exposure, not
  after it.

## Decision

**We will rate-limit by hashed client IP using a fixed-window counter in
Postgres, behind a `RateLimitStore` interface, and treat it as the third line of
defence rather than the first.**

Specifically:

1. **Order of defence is fixed, and the limiter is last.** Scheduled
   pre-aggregation first; a cache shared by all visitors second; the limiter
   third. With no per-user variation one upstream fetch serves every visitor, so
   caching is what actually decouples inbound traffic from outbound traffic. A
   feature that needs the limiter to be safe has probably skipped step 1.
2. **Fixed window, quantised on the wall clock.** Every instance derives the
   same window boundary from the same timestamp, so they all increment the same
   row without coordinating.
3. **One atomic statement.** `INSERT … ON CONFLICT DO UPDATE … RETURNING`. A
   `SELECT` then `UPDATE` loses increments under exactly the concurrency the
   limiter exists for.
4. **The stored key is a salted SHA-256 digest**, never a raw address. Scope is
   part of the digest so independent budgets stay independent.
5. **The client IP is read from the right-hand end of `X-Forwarded-For`**,
   stepping back `RATE_LIMIT_TRUSTED_PROXY_HOPS` entries (default 1). Callers we
   cannot identify share one bucket.
6. **Fail open**, with `degraded: true` on the decision and an error log.
7. **Call sites name no store.** Routes call `enforceRateLimit()`; the backing
   store is chosen in one file.

### The hard-rule #5 exception, stated precisely

Hard rule #5 forbids a public write path. This limiter writes to
`rate_limit_counters` on anonymous requests, so it is an exception and must be
justified rather than waved through:

- **No caller-supplied bytes are stored.** Both key columns are computed
  server-side — a digest and a quantised clock reading. There is no field whose
  contents an attacker chooses.
- **The only mutation is `+1` on an integer.** Nothing in the table is ever read
  back into a rendered page.
- **The table is disposable.** Truncating it costs a brief loss of limiting and
  nothing else.

Anything that fails those three tests is not covered by this exception.

## Consequences

### Good

- The limit is real across instances, which an in-memory `Map` cannot be.
- No new vendor, no new dependency, no hosting commitment — consistent with
  ADR-0006.
- Forging `X-Forwarded-For` does not mint fresh buckets; the spoof case is
  covered by tests, which is where this class of bug usually hides.
- A database dump is not a visitor log.
- Swapping to Redis later touches one file.

### Bad

- **A fixed window admits a 2× burst across a boundary** — the limit's worth of
  requests at 0:59 and again at 1:01. Accepted: we are damping sustained abuse,
  and a sliding window costs a sorted set we would need Redis for.
- **Every limited request costs a database round trip**, which is slower than
  Redis and consumes Neon compute. Mitigated by the limiter being last in the
  defence order — cached responses should not reach it at all.
- **Fail-open means a database outage silently disables limiting.**
  `degraded: true` exists so this is visible in logs rather than assumed.
- **Postgres has no TTL**, so expired rows need pruning by a scheduled job.
  Nothing breaks if pruning lapses; the table just grows.
- **IP is a blunt instrument.** A shared connection (a household, a university,
  mobile CGNAT) shares one budget. With ≤50 DAU this is theoretical, and the
  limits are set well above normal human use.

### Neutral

- Adds `RATE_LIMIT_TRUSTED_PROXY_HOPS` to the environment. It must be checked
  against the real topology when hosting is chosen — setting it too high reads
  attacker-controlled text as the client IP.
- Creates follow-on work: a `CRON_SECRET`-protected prune job, and edge/CDN
  limiting in front of this once a host is picked.

## Alternatives considered

| Alternative                                    | Why not chosen                                                                                                                                                                                                                    |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **In-memory `Map` of IP → count**              | The default mistake. Correct on localhost, silently useless in production: instances do not share memory, so the effective limit is N× the intended one and every instance's counter looks healthy.                               |
| **Upstash Redis / Vercel KV**                  | Faster, and TTL removes the pruning job. Rejected _for now_ on ADR-0006 grounds — it picks a vendor before we have picked a host — and because Postgres is already here. This is the documented upgrade path.                     |
| **Platform / WAF rate limiting only**          | The right outermost layer and we should add it, but it cannot be configured before a host is chosen, is not covered by our tests, and would leave the app unprotected in local and self-hosted runs. Complement, not replacement. |
| **Sliding-window log**                         | Removes the boundary burst. Needs per-request timestamp storage and a sorted structure; disproportionate for ≤50 DAU.                                                                                                             |
| **Token bucket in Postgres**                   | Smoother, and allows a deliberate burst allowance. Needs read-modify-write of a float plus a last-refill timestamp — either a transaction or a fiddlier single statement. Revisit if the boundary burst ever actually bites.      |
| **Storing raw IPs**                            | Simpler and readable in `psql`. Rejected: an IP is personal data, retention would need justifying, and we get nothing from it that a digest does not give.                                                                        |
| **No limiter; rely on the shared cache alone** | Tempting, since the cache is the bigger win. Rejected because a cache only helps on a hit — an attacker varying the item ID misses every time, and cache-miss amplification is the whole attack.                                  |
| **Leftmost `X-Forwarded-For` entry**           | Not a real alternative, but it is the common implementation and worth recording as rejected: it is fully client-controlled, so it gives an attacker unlimited fresh buckets while the limiter reports healthy.                    |

## Revisit if

- A host is chosen → configure edge/WAF limiting in front of this, and verify
  `RATE_LIMIT_TRUSTED_PROXY_HOPS` against that host's real topology.
- Neon compute cost or added latency becomes noticeable → move to Redis.
- An upstream provider contacts us about volume → tighten `RATE_LIMITS.strict`
  and reconsider the fixed window's boundary burst.
- The app ever gains a write path or an account system → fail-open must be
  re-argued for those routes.
