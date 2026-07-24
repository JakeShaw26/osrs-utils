# CLAUDE.md — project context

Loaded into every AI session. **Keep under ~200 lines** or it stops being read.
Updating this is part of the definition of done for any architectural change.

**Last updated:** 2026-07-24 (owner decisions: no bot, API-first, ToS compliance)
**Current phase:** P0 — Foundation. **No features are implemented.**

---

## What this is

A clan-scoped hub of Old School RuneScape utility tools (GE/economy, combat,
skilling, clues, quests, clan leaderboards and events) with Discord sign-in and
rank gating. One clan: assume ≤500 members, ≤50 DAU. **Not internet-scale** —
that assumption justifies most architecture choices.

Full requirements: [`PRD.md`](./PRD.md). Decisions: [`docs/adr/`](./docs/adr/).

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
5. **Authorisation is server-side, deny-by-default.** Never send officer data to
   the client and hide it with CSS. Filter at the query layer. (OWASP A01)
6. **Role revalidation fails CLOSED.** If the Discord check errors, deny — never
   fall back to cached roles. Falling back silently defeats the mechanism and
   lets a kicked officer keep access.
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

---

## Settled decisions

| Area             | Decision                                                           | ADR                                                          |
| ---------------- | ------------------------------------------------------------------ | ------------------------------------------------------------ |
| Hosting          | Next.js App Router, serverless routes                              | [0001](./docs/adr/0001-serverless-nextjs-architecture.md)    |
| Database         | Managed Postgres (Neon/Supabase) + Drizzle                         | [0001](./docs/adr/0001-serverless-nextjs-architecture.md)    |
| Player tracking  | **Delegated to Wise Old Man** — do not build snapshotting          | [0002](./docs/adr/0002-delegate-tracking-to-wise-old-man.md) |
| Price history    | 4 fixed ranges (2d/15d/90d/1y). No multi-year — data doesn't exist | [0003](./docs/adr/0003-price-history-depth.md)               |
| Static game data | OSRS Wiki **Bucket** API, fetched at build time                    | [0004](./docs/adr/0004-reject-osrsbox-db.md)                 |
| RSN linking      | Officer manual approval                                            | [0005](./docs/adr/0005-rsn-verification-method.md)           |
| Hosting tier     | **Deferred until the app is built** — keep jobs host-agnostic      | [0006](./docs/adr/0006-hosting-tier-and-scheduled-jobs.md)   |
| Third-party code | **API-first; copy nothing**                                        | [0007](./docs/adr/0007-api-first-no-code-redistribution.md)  |
| Styling          | Tailwind v4, CSS-first, two-layer semantic tokens                  | [0008](./docs/adr/0008-tailwind-v4-css-first-theming.md)     |
| Components       | Atomic design, lint-enforced layering                              | [0009](./docs/adr/0009-atomic-design-conventions.md)         |
| Discord          | **OAuth only — no bot, ever**                                      | [0010](./docs/adr/0010-no-discord-bot.md)                    |
| API compliance   | Non-commercial, read-only, self-limiting                           | [0011](./docs/adr/0011-third-party-api-compliance.md)        |

### Consequences of "no bot" that are easy to forget

- **Reminders** (farm runs) use **Web Push**, not Discord DMs.
- **Announcements** use a **Discord incoming webhook** (a URL — no bot needed).
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

Detail in [`docs/api-notes/`](./docs/api-notes/). Verified 2026-07-24:

- **Hiscores send no CORS header** → backend proxy mandatory.
- **Hiscores have no Combat Achievements, no Diaries, no quest data** → those
  trackers are member-declared and must never feed ranked leaderboards.
- **Price `/timeseries` caps at 365 points**: 5m=2.3d, 1h=15.3d, 6h=91.3d,
  24h=364d. ~1 year is the ceiling.
- **Bucket field names are not guessable** — `highalch` and `monster_name` are
  wrong; it's `high_alchemy_value` and `name`. Introspect the schema first.
- **`infobox_monster` has 55 fields**, enough for a full DPS calculator.
- **Wise Old Man:** 20 req/min, 100 with a free API key. MIT, actively maintained.
- **No DPS-calculation API exists.** The official calculator is client-side. We
  implement formulas ourselves from published maths, with golden-file tests.

---

## Open questions

Full list: PRD §9.1. **V1 and V11 are resolved** (ADR-0011, ADR-0010).

| #        | Question                                                                                                              | Blocks                                                         |
| -------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **V11a** | **10-min check:** confirm `guilds.members.read` returns roles with the app NOT in the guild. Auth model depends on it | **P0 — do first**                                              |
| **V10**  | Does a cheap WOM **group-level** update endpoint exist?                                                               | P3                                                             |
| **V3**   | Current GE tax rate, cap and exemptions — rules have changed                                                          | Flipping calculator                                            |
| V2       | TempleOSRS terms + API unread (403)                                                                                   | Collection log                                                 |
| V5       | WOM stance on scheduled group updates                                                                                 | Before P3                                                      |
| V4       | Hiscores update latency → is the XP-delta RSN challenge viable?                                                       | Self-serve linking                                             |
| V9       | Do quest/equipment/drop-table buckets exist?                                                                          | Quests, gear compare                                           |
| V13      | Free-tier cron limits + hosting cost                                                                                  | [ADR-0006](./docs/adr/0006-hosting-tier-and-scheduled-jobs.md) |

---

## P0 auth — in progress

**Built and tested (52 tests passing):**

| Module                     | Purpose                                                                         |
| -------------------------- | ------------------------------------------------------------------------------- |
| `lib/auth/tiers.ts`        | Tier hierarchy + Discord role → tier. Highest wins; unknown roles ignored       |
| `lib/auth/access.ts`       | **`decideAccess()` — the fail-closed decision.** Pure function, mutation-tested |
| `lib/auth/discord.ts`      | Guild-member fetch; maps each HTTP status to a `RoleCheck`                      |
| `lib/auth/role-mapping.ts` | Loads role map from `clan_config`; malformed config → `{}` → guest              |
| `lib/auth/session.ts`      | `requireTier()` / `assertTier()` — the one authorisation entry point            |
| `lib/auth/config.ts`       | Auth.js v5, scopes `identify guilds guilds.members.read`, guild gate at sign-in |
| `app/signin/page.tsx`      | Server-rendered sign-in, no client JS                                           |

**Design notes worth not re-deriving:**

- `requireTier` defaults `privileged` to **true** for officer+ requirements, so
  forgetting the flag produces a _stricter_ check, never a weaker one.
- Only **404** is treated as "not a member" (revokes session). 401/403 are
  `unavailable` — treating 403 as absence would de-link the whole clan on one
  scope misconfiguration.
- Malformed 200 payloads → `unavailable`, never `guest`. Silently stripping
  permissions looks like success and is hard to diagnose.

### ⚠️ Blocking: run V11a before going further

```bash
npm run verify:discord     # needs .env.local + a throwaway Discord app
```

Create the app at discord.com/developers, add redirect URI
`http://localhost:53134/callback`, and **do not add it to the guild** — that is
the whole point of the test. A `200` with a `roles` array confirms ADR-0010.

### Next auth tasks (in order)

1. **Run V11a.** Everything below assumes it passes.
2. **Move Discord tokens out of the JWT into the database**, with refresh
   rotation and encryption at rest. Currently they live in the Auth.js JWE
   cookie — encrypted and httpOnly, but PRD §5.2 asks for server-side storage.
   **Known deviation, flagged in `lib/auth/config.ts`.**
3. **Persist members on sign-in** (`members` table), then wire
   `cached_role` / `roles_checked_at` into `requireTier`'s `cached` argument —
   currently `undefined`, so an outage denies rather than serving stale roles.
   Safe, but stricter than designed.
4. Seed `clan_config` with the role mapping from V11a's output.
5. RSN link submission + officer approval queue.

## Elsewhere: scaffolded, not implemented

Other tables have no writers; `src/app/page.tsx` is a component/token proof, not
a real landing page. No calculators, no data fetching yet.

---

## When you make a decision

Write the ADR **in the same PR**, using the `write-adr` skill or
[`docs/adr/0000-template.md`](./docs/adr/0000-template.md). Add the index row.
Then update this file if it changes architecture, adds a data source, or
resolves an open question above.
