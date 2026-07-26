# Handoff — 2026-07-26

Snapshot for picking this up cold. **Living context is [`CLAUDE.md`](./CLAUDE.md)** —
read that first; this file covers what just happened and what to do next.

Rewrite this file when Phase B is under way. A stale handoff is worse than none.

---

## Where we stand in one paragraph

**Phase A is complete.** The four shared foundations exist, are tested, and are
documented: a rate limiter with a genuinely shared counter, a prices client, a
Wiki Bucket client, and the shared atoms. `npm run check` is green (75 tests, up
from 17) and the secret-free build passes. Along the way the Bucket API was
re-probed live, which resolved most of open question **V9** — quest and
equipment-stat buckets exist, drop tables do not — and turned up an injection
surface nobody had noticed. **Still no user-facing feature exists.** Phase B is
the fan-out to parallel feature agents, and it has not started.

---

## Repository state

- **Remote:** <https://github.com/JakeShaw26/osrs-utils> · branch `main`
- **CI:** `.github/workflows/ci.yml` — typecheck, lint, format, tests, build on
  push to `main` and every PR. Runs with **no secrets**, deliberately.
- **Tests:** 75 passing, 6 files. **Node 24.**
- **Clan:** Void Reavers, **WOM group `25092`**, 78 members (measured).
- **Migrations:** `drizzle/0001_ordinary_multiple_man.sql` adds
  `rate_limit_counters` and **has not been applied to any database yet.**

---

## What Phase A actually built

### A1. Rate limiting — `src/lib/ratelimit/`

Closes the open-proxy hole that removing auth reopened (PRD finding M2). Full
reasoning: [ADR-0013](./docs/adr/0013-rate-limiting-shared-store.md).

| File                | Role                                                             |
| ------------------- | ---------------------------------------------------------------- |
| `index.ts`          | `enforceRateLimit()`, `RATE_LIMITS`, `tooManyRequests()`         |
| `types.ts`          | `RateLimitStore` interface + the pure `decide()`                 |
| `identity.ts`       | Client IP extraction and key hashing — the security-critical bit |
| `postgres-store.ts` | Atomic upsert counter + `pruneRateLimitCounters()`               |
| `memory-store.ts`   | Tests only, and labelled as such                                 |

Three things worth knowing before you touch a route:

1. **It is the third line of defence.** Pre-aggregate, then cache, then limit.
   Reaching for the limiter first usually means the feature should have been
   pre-aggregated.
2. **The IP comes from the _right_ of `X-Forwarded-For`.** Everything to the
   left is attacker-supplied. `RATE_LIMIT_TRUSTED_PROXY_HOPS` controls how far
   in to step; setting it too high silently disables limiting.
3. **It fails open.** A store outage allows the request and sets
   `degraded: true`. Log that — a dead limiter and a healthy one look identical
   otherwise.

Usage:

```ts
const decision = await enforceRateLimit(request, {
  scope: 'hiscores',
  rule: RATE_LIMITS.lookup,
});
if (!decision.allowed) return tooManyRequests(decision);
```

### A2. Prices — `src/lib/api/prices.ts`

`/latest`, `/mapping`, `/5m`, `/1h`, `/timeseries`. Two design points:

- **Single-item lookups are served from the bulk `/latest` response**, not
  `?id=`. One shared cache entry serves every visitor and every item, so
  outbound traffic stops scaling with what people search for.
- **`timestepForDays()` encodes the 365-point cap** so a "30-day chart" cannot
  silently truncate. ~1 year is the ceiling of the data (ADR-0003).

### A3. Wiki Bucket — `src/lib/api/wiki-bucket.ts`

**This one changed what we know about the API.** Probing it live turned up
three things the existing notes did not have:

- **The `query` parameter is parsed as a program.** A raw apostrophe returns
  `')' expected near 's'` — a parser error. Interpolating an item name is
  therefore **injection**, not a formatting bug, and OSRS names are full of
  apostrophes. `escapeLiteral()` escapes `\` _before_ `'`; reversing those two
  lines lets a trailing backslash escape our own closing quote. Tested.
- **A bad query returns HTTP 200** with an `error` field, so a typo'd field name
  otherwise looks like a legitimately empty result.
- **`page_name` exists on every bucket** and appears in no published schema. It
  is the only key that joins buckets — `infobox_bonuses` has no item-name field.

**V9 is now mostly resolved:** `infobox_bonuses` (18 fields, full equipment
stats) and `quest` (9 fields, but wiki _prose_, not structured data) both exist.
No drop-table bucket exists under any obvious name.

Details: [`docs/api-notes/osrs-wiki-bucket.md`](./docs/api-notes/osrs-wiki-bucket.md).

### A4. Atoms — `Input`, `Select`, `Table`

Plus `TableHead/Body/Row/HeaderCell/Cell/EmptyRow`. Semantic tokens only, no
`dark:` variants, `numeric` applies `.tabular` + right alignment. Inventory in
[`src/components/README.md`](./src/components/README.md).

**`Table` is primitives, not a data table.** A generic `<Table data columns>`
accretes sorting, filtering, pagination and formatting until it is the hardest
component in the repo. Compose the primitives in an organism instead.

---

## Phase B — parallel feature agents

Feature groups are now genuinely independent: **Economy, Combat, Skilling,
Clues, Quests, Utility.** Each owns `src/app/<feature>/` and
`src/lib/<feature>/`.

**Use git worktrees, not branches in place.** One working directory can only
have one branch checked out; agents sharing a folder corrupt each other
regardless of branch. The Agent tool's `isolation: "worktree"` handles this.

Rules that keep merges clean:

1. **Agents do not edit `CLAUDE.md`, `docs/README.md`, or `package.json`.**
   Three agents appending an ADR index row collide on the same lines every time.
   They report intended changes; reconcile at merge.
2. **ADRs as new files, no index row** — new files never conflict.
3. **`npm run check` must pass before an agent reports done.**
4. **Nobody adds a second `Input`.** The shared atoms exist precisely so five
   agents don't produce five of them. Extend, don't fork.
5. **Any route touching an upstream on request gets `enforceRateLimit()`** —
   or, better, gets pre-aggregated so it doesn't touch an upstream at all.
6. Each worktree needs its own `npm install` (546 MB) **and a copy of
   `.env.local`**, which is gitignored and therefore absent from a fresh
   worktree. The owner must provide it.

**Suggested order.** Economy first — it needs no clan data and its client is
already built. V3 blocks only the flipping calculator within it, not the group.
Combat is next-best now that `infobox_bonuses` and `infobox_monster` are both
confirmed to cover a DPS calculator.

---

## Open questions

Resolved: V1, V11, V14, and most of V9. Moot: V11a, V4 (no auth, no RSN links).

| #   | Question                                       | Blocks              |
| --- | ---------------------------------------------- | ------------------- |
| V3  | Current GE tax rate, cap and exemptions        | Flipping calculator |
| V5  | WOM stance on our anonymous read cadence       | Caching design      |
| V10 | Cheap WOM group-level update endpoint?         | Scheduled refresh   |
| V2  | TempleOSRS terms unread (403)                  | Collection log      |
| V9b | Where do drop tables live, if not in a bucket? | Drop-table features |
| V13 | Free-tier cron limits + hosting cost           | ADR-0006            |

---

## Owner action items

1. **Apply the new migration** (`npm run db:migrate`) before any route calls
   `enforceRateLimit()` against the real store. Until then it fails open on
   every request — which is safe, but it is not rate limiting.
2. **`.env.local` is currently empty (0 bytes).** Nothing can run against real
   data until it is filled from `.env.example`. `RATE_LIMIT_TRUSTED_PROXY_HOPS`
   is optional and defaults to 1.
3. **Pin CI actions to commit SHAs** rather than `@v4`. A mutable tag can be
   repointed at malicious code; this is a real supply-chain vector. Noted
   inline in `.github/workflows/ci.yml`. _(Carried over — still not done.)_
4. Answer **V3** (GE tax) whenever convenient — the only thing blocking the
   highest-value calculator.
5. **Verify `RATE_LIMIT_TRUSTED_PROXY_HOPS` against the real topology** once a
   host is chosen, and add edge/WAF limiting in front of the app.

---

## Gotchas that will otherwise be rediscovered the hard way

- **`getEnv()` / `getDb()` inside functions, never at module scope.** Module
  scope runs during `next build` where secrets legitimately don't exist. This
  broke the build once already; CI's secret-free build step is the regression
  test.
- **Never concatenate a Bucket query.** See A3 above. Use `buildBucketQuery()`.
- **Bucket fields may be repeated arrays** — `item_id` is `["1127"]`, `max_hit`
  is `["41"]`, but `combat_level` is a plain number. Which is which is **not**
  predictable from the field's meaning. Unwrap with `firstValue()`.
- **Multi-version pages return multiple rows.** Zulrah is three rows with
  different defences. That is data, not duplication.
- **`roleOrders` indices are sparse** (`0,1,5,6,9,12,13,14,21,…`). Compare them;
  never treat one as an array position or a count.
- **`gained` returns fewer rows than `memberCount`** (485 of 488 observed) —
  members with no gain are omitted. Never index one list by the other.
- **`sortByRank` copies before sorting.** Callers pass the cached upstream
  response, and an in-place sort would corrupt a cache entry shared by every
  visitor — a bug that only appears under concurrency.
- **Never call OSRS APIs with bare `fetch()`** — lint enforces it. The Wiki
  blocks default agents, and forgetting the User-Agent doesn't fail in dev, it
  gets us blocked in production.
