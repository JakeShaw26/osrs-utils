# ADR-0006: Defer the hosting-tier decision; record the constraints now

- **Status:** **Deferred** — decision postponed to post-build by the owner
- **Date:** 2026-07-24
- **Deciders:** Repository owner

## Context

An earlier draft claimed hosting under £20/month while specifying an **hourly**
refresh job. The Fable review found these incompatible: **[UNVERIFIED — confirm
against current pricing]** Vercel's free Hobby tier restricts Cron Jobs to
roughly **once per day**, so sub-daily schedules require Pro (~£16/mo).

That draft's recommendation was to schedule from the always-on Discord bot host.
**[ADR-0010](./0010-no-discord-bot.md) removed the bot**, so that option no
longer exists.

The owner has decided **not to settle hosting until the app is built.** That is
reasonable: hosting is one of the few decisions that is genuinely cheap to defer
(it is a deployment concern, not an architectural one), and the real traffic and
job shape will be known by then.

This ADR therefore **records the constraints rather than making the choice**, so
the decision can be made quickly later with the facts already gathered.

## Decision

**Defer the hosting-tier and scheduler choice until the application is
functionally complete.**

Until then, **build so the choice stays open**:

1. **Scheduled work lives behind ordinary HTTP routes** protected by
   `CRON_SECRET`, not inside a platform-specific cron primitive. Any trigger —
   Vercel Cron, GitHub Actions, cron-job.org, a VPS crontab — can invoke them.
   Keeping the trigger external to the logic is what makes this deferrable.
2. **Jobs must be chunked, resumable and idempotent.** Advance the cursor only
   after a chunk's writes commit; upsert on `(rsn, snapshot_date)`; record
   `last_completed_pass_at` so a stuck job surfaces a staleness warning. This
   holds regardless of host, and it is what lets a 25-minute workload run under
   a 60-second execution limit.
3. **No dependency on a persistent process.** With the bot gone, nothing in the
   architecture requires an always-on host — do not reintroduce one casually.

## Constraints for whoever makes this decision later

| Constraint         | Detail                                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Refresh arithmetic | 500 members ÷ 20 req/min (WOM, no key) ≈ **25 minutes**. With an API key (100/min) ≈ **5 minutes** — **get the key first; it may change the answer entirely** |
| Serverless limits  | Vercel 60s (Hobby) / 300s (Pro). Neither fits an unchunked full pass                                                                                          |
| Free-tier cron     | ~once daily **[UNVERIFIED — V13]**                                                                                                                            |
| Realistic costs    | Hobby + managed Postgres ≈ **£0–5/mo**; Pro ≈ **£16–20/mo**                                                                                                   |
| Freshness need     | Hourly is a nice-to-have for a clan leaderboard, not a requirement                                                                                            |
| External triggers  | GitHub Actions scheduled workflows give free sub-daily cron against our protected route                                                                       |

## Consequences

### Good

- Avoids committing money before we know the workload.
- Designing for an external trigger keeps every option open — including hosts we
  have not considered — at essentially no extra cost.
- The chunked/idempotent job design is required under _every_ option, so it can
  be built now with no risk of rework.

### Bad

- **An open decision is a decision that can be forgotten.** Tracked as V13 and
  in `CLAUDE.md`.
- Until settled, we cannot state a hosting cost, so PRD goal G4 stays
  provisional.
- If the app is built assuming abundant execution time, moving to serverless
  later would hurt — hence rule 2 above being mandatory now rather than later.

### Neutral

- Nothing here blocks P0–P2; scheduled jobs are not needed until P3.

## Alternatives considered

| Alternative                                    | Why not chosen                                                                                                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Decide now: Vercel Pro, hourly cron**        | Simplest, one platform. Rejected: pays for capacity before knowing whether it is needed.                                                                     |
| **Decide now: Hobby + GitHub Actions trigger** | Very likely the eventual answer — free, sub-daily, and works with the protected-route design. Still premature: needs the WOM API key question settled first. |
| **Persistent host (Railway/Fly/VPS)**          | No execution limits, trivial cron. With the bot gone there is no longer a standing reason to run one.                                                        |

## Revisit if

- **The app reaches feature completeness** → make the call, this is the trigger.
- **V13** (free-tier cron limits) is confirmed.
- A WOM API key materially changes the refresh arithmetic.
