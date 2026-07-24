# ADR-0001: Serverless Next.js on Vercel with managed Postgres

- **Status:** Accepted
- **Date:** 2026-07-24
- **Deciders:** PRD §4.2

## Context

A backend is unavoidable. Four independent forcing functions, any one sufficient
(PRD §4.1):

1. **Verified:** the Jagex hiscores response carries no `Access-Control-Allow-Origin`
   header, so browsers block direct calls. A proxy is mandatory.
2. Discord OAuth requires a client secret to exchange the auth code.
3. Rank gating must be server-enforced — client-side checks are decoration
   (OWASP A01).
4. Writes need durable storage.

Traffic is one clan: assume ≤500 members, ≤50 DAU, ≤5 concurrent.

## Decision

**Next.js App Router on Vercel; Route Handlers as serverless functions; managed
serverless Postgres (Neon or Supabase); Drizzle for schema and migrations.**

All serverless routes use the **pooled** connection string. The direct
connection is for migrations only.

Pure calculators are built to work logged-out, with no backend dependency.

## Consequences

### Good

- Scales to zero; no idle cost for a bursty, tiny workload.
- One deployment unit — no separate backend for a solo developer to maintain.
- Postgres suits the data: relational, with aggregate/leaderboard queries.
- Most of the site keeps working if auth or the DB is down.

### Bad

- **Execution time limits** (60s Hobby / 300s Pro) constrain bulk jobs. This is
  the real cost, and it shapes the whole refresh design — see ADR-0006.
- Cold starts. Acceptable; this is not latency-critical.
- **Connection exhaustion** if the direct connection string is ever used in a
  route. Fails only under load, never locally.
- Vendor coupling to Vercel's cron and runtime.

### Neutral

- The Discord bot cannot be serverless (it needs a persistent gateway
  connection) and lives as a separate always-on service. See ADR-0006.

## Alternatives considered

| Alternative                                   | Why not chosen                                                                                                                                                                                         |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Persistent Node service (Railway/Fly/VPS)** | No execution limits and simpler cron. **Genuinely close** — becomes correct if the bot grows or we take on our own snapshotting. Rejected for now on always-on cost and maintenance for one developer. |
| **Static site, no backend**                   | Impossible: defeated by CORS, OAuth secrets and server-side authorisation.                                                                                                                             |
| **Separate SPA + standalone API**             | Two deploys, two repos, CORS config, no SSR benefit. Cost without benefit at this scale.                                                                                                               |
| **Supabase-only (BaaS)**                      | Handles DB and auth but not the Wiki/hiscores proxying or the User-Agent requirement. Splits the backend rather than removing it.                                                                      |

## Revisit if

- Clan size or traffic grows by an order of magnitude.
- The bot accumulates enough responsibility to justify consolidating on a
  persistent host.
- **V10 resolves badly** — if no cheap WOM group-update endpoint exists, the
  refresh job may not fit serverless limits at all (PRD §9.1).
