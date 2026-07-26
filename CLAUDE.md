# CLAUDE.md — project context

Loaded into every AI session. **Keep under ~200 lines** or it stops being read.
Updating this is part of the definition of done for any architectural change.

**Last updated:** 2026-07-26 (Phase A complete — shared foundations landed)
**Current phase:** Phase A done; **Phase B (parallel feature agents) not started.**
**No user-facing features are implemented.**

---

## What this is

A hub of Old School RuneScape utility tools (GE/economy, combat, skilling,
clues, quests, clan leaderboards) for one clan: **Void Reavers, WOM group
`25092`, 78 members** (measured 2026-07-24, not assumed). ≤50 DAU. **Not
internet-scale** — that assumption justifies most architecture choices. The PRD
plans for ≤500 as headroom; the real figure is ~6× smaller.

**There is no sign-in.** The app is public and read-only to everyone
([ADR-0012](./docs/adr/0012-no-authentication-public-read-only.md)). Clan
identity comes from `WOM_GROUP_ID`; membership of that group is the roster. If
you find yourself reaching for a session, a user, or a permission check — stop,
and re-read ADR-0012.

Full requirements: [`PRD.md`](./PRD.md). Decisions: [`docs/adr/`](./docs/adr/).
**Resuming after a break?** [`HANDOFF.md`](./HANDOFF.md) has the Phase B plan.

---

## Hard rules — violating these breaks production, not just style

1. **Never call OSRS APIs with bare `fetch()`.** Use `osrsFetch()` in
   [`src/lib/api/osrs-fetch.ts`](./src/lib/api/osrs-fetch.ts). It sets the
   User-Agent the Wiki **requires** — the Wiki blocks default agents, and
   forgetting it doesn't fail in dev, it gets us blocked in production. Lint
   enforces this.
2. **Never validate env or build clients at module scope.** Use `getEnv()` /
   `getDb()` **inside functions**. Module scope runs during `next build`, where
   secrets legitimately don't exist.
3. **Never use the direct Postgres connection string in a route.** Serverless
   functions must use the **pooled** URL or they exhaust `max_connections`.
   Fails only under load — never locally.
4. **No user-facing request may fan out across clan members.** 500 members at
   WOM's 20 req/min is a 25-minute page load. Read pre-aggregated data.
   `assertNoFanOut()` makes it fail loudly.
5. **No public write path may exist.** There is no auth, so _every_ request is
   anonymous and untrusted. The only writers are `CRON_SECRET`-authenticated
   scheduled jobs and build-time fetches. A route handler that mutates state for
   a public caller is a defect. (OWASP A01 — ADR-0012)
   _One documented exception,_ `rate_limit_counters`: no caller-supplied bytes,
   increment-only, disposable. Anything failing all three tests isn't covered
   (ADR-0013).
6. **Never build anything that assumes a signed-in user.** No sessions, no
   accounts, no officer-only views, no per-user server state. Personal data
   (flip logs, timers, gear setups) belongs in the member's **browser**
   (`localStorage`/IndexedDB), never in our database.
7. **Never put a secret in a `NEXT_PUBLIC_*` variable.** Next.js inlines those
   into the client bundle.
8. **Never use `osrsbox-db`.** Looks authoritative, README claims weekly
   updates — last commit **2021-09-30**. Use the Wiki Bucket API.
9. **Never copy third-party source into this repo.** Call APIs; where none
   exists, implement from published formulas. ([ADR-0007](./docs/adr/0007-api-first-no-code-redistribution.md))
10. **[`docs/api-terms.md`](./docs/api-terms.md) is binding.** Non-commercial,
    read-only, self-limiting, honest identification. Treat its rules like
    "don't commit secrets" — if a task seems to require breaking one, stop and
    flag it. ([ADR-0011](./docs/adr/0011-third-party-api-compliance.md))
11. **Never build a Wiki Bucket query by concatenation.** The wiki parses the
    `query` parameter as a program, so an interpolated item name is injection
    (OWASP A03). Use `buildBucketQuery()` in `lib/api/wiki-bucket.ts`.

---

## Settled decisions

| Area             | Decision                                                           | ADR                                                           |
| ---------------- | ------------------------------------------------------------------ | ------------------------------------------------------------- |
| Hosting          | Next.js App Router, serverless routes                              | [0001](./docs/adr/0001-serverless-nextjs-architecture.md)     |
| Database         | Managed Postgres (Neon/Supabase) + Drizzle                         | [0001](./docs/adr/0001-serverless-nextjs-architecture.md)     |
| Player tracking  | **Delegated to Wise Old Man** — do not build snapshotting          | [0002](./docs/adr/0002-delegate-tracking-to-wise-old-man.md)  |
| Price history    | 4 fixed ranges (2d/15d/90d/1y). No multi-year — data doesn't exist | [0003](./docs/adr/0003-price-history-depth.md)                |
| Static game data | OSRS Wiki **Bucket** API, fetched at build time                    | [0004](./docs/adr/0004-reject-osrsbox-db.md)                  |
| ~~RSN linking~~  | ~~Officer manual approval~~ — **obsolete, no accounts to link to** | ~~[0005](./docs/adr/0005-rsn-verification-method.md)~~        |
| Hosting tier     | **Deferred until the app is built** — keep jobs host-agnostic      | [0006](./docs/adr/0006-hosting-tier-and-scheduled-jobs.md)    |
| Third-party code | **API-first; copy nothing**                                        | [0007](./docs/adr/0007-api-first-no-code-redistribution.md)   |
| Styling          | Tailwind v4, CSS-first, two-layer semantic tokens                  | [0008](./docs/adr/0008-tailwind-v4-css-first-theming.md)      |
| Components       | Atomic design, lint-enforced layering                              | [0009](./docs/adr/0009-atomic-design-conventions.md)          |
| ~~Discord~~      | ~~OAuth only — no bot~~ — **Discord removed entirely**             | ~~[0010](./docs/adr/0010-no-discord-bot.md)~~                 |
| API compliance   | Non-commercial, read-only, self-limiting                           | [0011](./docs/adr/0011-third-party-api-compliance.md)         |
| **Auth**         | **None. Public, read-only. Clan identity = WOM group ID**          | [0012](./docs/adr/0012-no-authentication-public-read-only.md) |
| Rate limiting    | Hashed IP, fixed window, shared Postgres counter, fails open       | [0013](./docs/adr/0013-rate-limiting-shared-store.md)         |

### Consequences of "no auth" that are easy to forget

- **Officer-only views are impossible**, not merely hard — hiding one
  client-side is the exact OWASP A01 failure hard rule #5 exists to prevent.
  **Custom clan events / bingo boards** are gone too; they need trusted writes,
  and WOM competitions cover the common case.
- **Self-declared trackers** (CAs, diaries, quests) live in browser storage and
  vanish if a member clears it. Offer export/import.
- **⚠️ We are an open proxy unless deliberately defended.** Any route proxying
  an upstream needs **pre-aggregation, then a shared cache, then rate limiting**
  — in that order — or a stranger hammers Jagex from our IP and _we_ get
  blocked. `enforceRateLimit()` exists now, but it is the **third** line of
  defence; needing it to be safe usually means step 1 was skipped. (PRD §5.3)
- **Everything is cacheable** — no per-user variation, so responses cache at the
  edge for all visitors. Caching is a security control here, not just speed.
- **Scheduling** comes from platform cron or an external trigger hitting a
  `CRON_SECRET`-protected route. Never assume a persistent process exists.

---

## Conventions

- **Components:** `atoms → molecules → organisms → templates`, pages in
  `src/app/`. A layer may only import from below. Atoms/molecules/templates
  **never** fetch. See [`src/components/README.md`](./src/components/README.md).
- **Domain logic in `src/lib/`**, never in components — calculators must be
  testable without rendering.
- **Semantic tokens only.** `bg-surface-raised`, not `bg-slate-900`, never
  `bg-[#171c25]`. No `dark:` variants in components. See
  [`docs/theming.md`](./docs/theming.md).
- **`"use client"` on the smallest leaf that needs it**, never on a page.
- **`.tabular`** on every GP/XP/DPS number so digits align and don't jitter.
- **Server Components by default.**

---

## Verified API facts (don't re-derive)

Detail in [`docs/api-notes/`](./docs/api-notes/). Verified 2026-07-24, extended
2026-07-26. All of these were measured against live endpoints, not read from docs:

- **Hiscores send no CORS header** → backend proxy mandatory.
- **Hiscores have no Combat Achievements, no Diaries, no quest data** → those
  trackers are member-declared and must never feed ranked leaderboards.
- **Price `/timeseries` caps at 365 points**: 5m=2.3d, 1h=15.3d, 6h=91.3d,
  24h=364d. ~1 year is the ceiling.
- **Bucket field names are not guessable** — `highalch` and `monster_name` are
  wrong; it's `high_alchemy_value` and `name`. Introspect the schema first.
- **`infobox_monster` has 55 fields**, enough for a full DPS calculator.
- **A bad Bucket query returns HTTP 200** with an `error` field, so a status
  check misses it and a typo looks like an empty result set.
- **Buckets that exist** (V9, verified 2026-07-26): `infobox_item`,
  `infobox_monster`, `infobox_bonuses` (full equipment stats), `quest` (prose,
  not structured). **No drop-table bucket.** `page_name` is on every bucket and
  is the only key that joins them.
- **Wise Old Man:** 20 req/min, 100 with a free API key. MIT, actively maintained.
- **WOM group endpoints need no auth and no key.** Roster, `roleOrders`,
  `gained` leaderboards and competitions are **one request each**, unpaginated —
  clan views never fan out. Our group `25092` is 46 KB / 78 members and actively
  maintained (every player refreshed within 3.3 days).
  **Two traps:** `roleOrders` indices are **sparse** (`0,1,5,6,9,12,…`) — compare
  them, never treat one as a position; and `gained` returns fewer rows than
  `memberCount`, so never index one list by the other.
  Full detail: [`wise-old-man-groups.md`](./docs/api-notes/wise-old-man-groups.md).
- **No DPS-calculation API exists.** The official calculator is client-side. We
  implement formulas ourselves from published maths, with golden-file tests.

---

## Open questions

Full list: PRD §9.1. **V1, V11, V14 resolved**; **V9 mostly resolved** — quest
and equipment buckets exist, drop tables do not. **V11a and V4 are moot** —
there is no auth and no RSN linking to verify (ADR-0012).

| #      | Question                                                     | Blocks                                                         |
| ------ | ------------------------------------------------------------ | -------------------------------------------------------------- |
| **V3** | Current GE tax rate, cap and exemptions — rules have changed | Flipping calculator                                            |
| **V5** | WOM rate limits / stance on our anonymous read cadence       | Caching design                                                 |
| V10    | Does a cheap WOM **group-level** update endpoint exist?      | P3                                                             |
| V2     | TempleOSRS terms + API unread (403)                          | Collection log                                                 |
| V9b    | Where do drop tables live, if not in a bucket?               | Drop-table features only                                       |
| V13    | Free-tier cron limits + hosting cost                         | [ADR-0006](./docs/adr/0006-hosting-tier-and-scheduled-jobs.md) |

---

## The auth module was deleted

`src/lib/auth/` (7 modules, 52 tests), the sign-in page, the Auth.js route and
the Discord verify script were removed when ADR-0012 landed, and are preserved
in commit **`5202810`**. If auth ever returns, recover rather than rewrite —
`git show 5202810:src/lib/auth/access.ts`. `decideAccess()` was mutation-tested.

## Built so far

| Module                   | Purpose                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------- |
| `lib/api/osrs-fetch.ts`  | The only outbound chokepoint. User-Agent, per-source TTLs, `assertNoFanOut`        |
| `lib/api/wom-group.ts`   | Clan roster / `gained` leaderboards / competitions. Typed against the real payload |
| `lib/api/prices.ts`      | GE prices. Bulk `/latest` over per-item; `timestepForDays` enforces the 365 cap    |
| `lib/api/wiki-bucket.ts` | Static game data. `buildBucketQuery` is the injection boundary — never concatenate |
| `lib/ratelimit/`         | `enforceRateLimit()` + shared Postgres counter. Store is swappable behind an iface |
| `lib/clan/ranks.ts`      | Rank ordering from `roleOrders`. Pure, no network — **no hardcoded ladder**        |
| `lib/utils/format-gp.ts` | GP formatting; truncates towards zero so money is never overstated                 |

**Atoms:** `Button`, `Input`, `Select`, `Table` (+ cells), `PriceTag`,
`StatBadge` — check [`src/components/README.md`](./src/components/README.md)
before writing a new one.

75 tests. The escaping and IP-spoofing tests encode behaviour verified against
live APIs; `ranks.test.ts` uses the real Void Reavers `roleOrders` fixture.

## Next tasks

**Phase B — parallel feature agents.** Feature groups are now independent:
Economy, Combat, Skilling, Clues, Quests, Utility. Each owns
`src/app/<feature>/` and `src/lib/<feature>/`. See [`HANDOFF.md`](./HANDOFF.md)
for the worktree rules that keep merges clean.

Highest value first: **Economy** (no clan data, no blockers except V3 for the
flipping calculator), then a **roster page** over `sortByRank`/`groupByRank`
surfacing `player.updatedAt` so staleness is visible rather than implied.

## Elsewhere: built, but nothing renders it

**No page consumes any `lib/api/` client yet** — all are tested, none are
displayed; the first feature agent is their first caller. `daily_snapshots` has
no writer, and `src/app/page.tsx` is a token proof, not a landing page.
`rate_limit_counters` wants a `CRON_SECRET`-protected `pruneRateLimitCounters()`
job — nothing breaks without it, the table just grows.

---

## When you make a decision

Write the ADR **in the same PR**, using the `write-adr` skill or
[`docs/adr/0000-template.md`](./docs/adr/0000-template.md). Add the index row.
Then update this file if it changes architecture, adds a data source, or
resolves an open question above.
