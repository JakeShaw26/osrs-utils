# CLAUDE.md — project context

Loaded into every AI session. **Keep under ~200 lines** or it stops being read.
Updating this is part of the definition of done for any architectural change.

**Last updated:** 2026-08-01
**Current phase:** **Phase B complete; the ADR-0020 redesign is 3 of 4 steps in.**
All six feature slices are on `origin/main` — **27 routes, 1133 tests**, CI
green. The palette is re-pointed to Nero Marquina in both themes, the labelled
fields are de-duplicated, and `ItemIcon` brings real OSRS item art in by item id
(ADR-0021), delivered as ten committed atlas sheets (ADR-0022). **Page-level
layout and navigation is still the remaining ADR-0020 step.** The rate-limit
migration is applied to local Postgres and `enforceRateLimit()` is verified
end-to-end (20 requests pass, the 21st gets a 429).

**Icon delivery is no longer blocking.** The atlas is committed, so a fresh
checkout has icons and `ItemIcon` is safe to use in a route. **One consequence
to know:** Jagex artwork is now in git, so "make the repo public" to unlock
branch protection is effectively foreclosed — see ADR-0022.

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
   _One documented exception,_ **item artwork**: we display Jagex's item icons,
   written only by `scripts/generate-item-icons.mjs`, packed by
   `scripts/pack-item-icons.mjs` and served same-origin. That is a deliberate,
   owner-approved extension of the "tolerated ≠ licensed" bet, scoped to icons
   ([ADR-0021](./docs/adr/0021-osrs-item-icons-by-id.md),
   [ADR-0022](./docs/adr/0022-item-icon-delivery-packed-atlas.md)). It does not
   license copying anything else — least of all code. Never re-fetch per build
   (~4,600 wiki requests); the committed atlas exists so the build never needs
   the wiki.
10. **[`docs/api-terms.md`](./docs/api-terms.md) is binding.** Non-commercial,
    read-only, self-limiting, honest identification. Treat its rules like
    "don't commit secrets" — if a task seems to require breaking one, stop and
    flag it. ([ADR-0011](./docs/adr/0011-third-party-api-compliance.md))
11. **Never build a Wiki Bucket query by concatenation.** The wiki parses the
    `query` parameter as a program, so an interpolated item name is injection
    (OWASP A03). Use `buildBucketQuery()` in `lib/api/wiki-bucket.ts`.

---

## Settled decisions

| Area             | Decision                                                           | ADR                                                                    |
| ---------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Hosting          | Next.js App Router, serverless routes                              | [0001](./docs/adr/0001-serverless-nextjs-architecture.md)              |
| Database         | Managed Postgres (Neon/Supabase) + Drizzle                         | [0001](./docs/adr/0001-serverless-nextjs-architecture.md)              |
| Player tracking  | **Delegated to Wise Old Man** — do not build snapshotting          | [0002](./docs/adr/0002-delegate-tracking-to-wise-old-man.md)           |
| Price history    | 4 fixed ranges (2d/15d/90d/1y). No multi-year — data doesn't exist | [0003](./docs/adr/0003-price-history-depth.md)                         |
| Static game data | OSRS Wiki **Bucket** API, fetched at build time                    | [0004](./docs/adr/0004-reject-osrsbox-db.md)                           |
| ~~RSN linking~~  | ~~Officer manual approval~~ — **obsolete, no accounts to link to** | ~~[0005](./docs/adr/0005-rsn-verification-method.md)~~                 |
| Hosting tier     | **Deferred until the app is built** — keep jobs host-agnostic      | [0006](./docs/adr/0006-hosting-tier-and-scheduled-jobs.md)             |
| Third-party code | **API-first; copy nothing**                                        | [0007](./docs/adr/0007-api-first-no-code-redistribution.md)            |
| Styling          | Tailwind v4, CSS-first, two-layer semantic tokens                  | [0008](./docs/adr/0008-tailwind-v4-css-first-theming.md)               |
| Components       | Atomic design, lint-enforced layering                              | [0009](./docs/adr/0009-atomic-design-conventions.md)                   |
| ~~Discord~~      | ~~OAuth only — no bot~~ — **Discord removed entirely**             | ~~[0010](./docs/adr/0010-no-discord-bot.md)~~                          |
| API compliance   | Non-commercial, read-only, self-limiting                           | [0011](./docs/adr/0011-third-party-api-compliance.md)                  |
| **Auth**         | **None. Public, read-only. Clan identity = WOM group ID**          | [0012](./docs/adr/0012-no-authentication-public-read-only.md)          |
| Rate limiting    | Hashed IP, fixed window, shared Postgres counter, fails open       | [0013](./docs/adr/0013-rate-limiting-shared-store.md)                  |
| Economy data     | Bulk price feeds only, server-rendered — never per-item upstream   | [0014](./docs/adr/0014-economy-bulk-only-data-access.md)               |
| Combat maths     | Implemented from published formulas; tiered golden tests           | [0015](./docs/adr/0015-combat-engine-from-published-formulas.md)       |
| Skilling rates   | Authored in-repo, versioned and sourced — no rates API exists      | [0016](./docs/adr/0016-authored-skilling-rates-in-repo.md)             |
| Clue data        | Partial dataset; solvable clue types derived, not stored           | [0017](./docs/adr/0017-partial-clue-dataset-with-derivable-solvers.md) |
| Quest data       | Authored requirement graph; completion is self-declared            | [0018](./docs/adr/0018-authored-quest-requirements-graph.md)           |
| Authored rules   | Versioned, sourced, confidence-graded — never bare constants       | [0019](./docs/adr/0019-versioned-authored-game-rules.md)               |
| Visual direction | **B · Nero Marquina.** Layer 1 re-point only; light is first-class | [0020](./docs/adr/0020-nero-marquina-visual-direction.md)              |
| Item artwork     | Real OSRS icons by item id, same-origin                            | [0021](./docs/adr/0021-osrs-item-icons-by-id.md)                       |
| Icon delivery    | Ten committed atlas sheets; index in the manifest = cell           | [0022](./docs/adr/0022-item-icon-delivery-packed-atlas.md)             |
| Feature sprites  | **Deleted.** `ItemIcon` is all of tier one now                     | [0023](./docs/adr/0023-retire-the-hand-drawn-sprite-system.md)         |

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
- **Semantic tokens only.** `bg-surface-raised`, not `bg-stone-900`, never
  `bg-[#171c25]`. No `dark:` variants in components. See
  [`docs/theming.md`](./docs/theming.md). **`token-contrast.test.ts` parses
  `globals.css` and measures every pair in both themes** — it is the only thing
  here that can see a contrast ratio, so a new text token must be added to it.
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
- **~47 buckets exist**, not 4 (probed 2026-07-26). An earlier version of this
  file listed four and asserted **"no drop-table bucket"** — that was **wrong**.
  Absence from the list below means _unverified_, never _nonexistent_; probe
  before concluding a bucket doesn't exist. Verified so far: `infobox_item`,
  `infobox_monster`, `infobox_bonuses` (full equipment stats), `quest` (prose,
  not structured), `combat_achievement` (646 structured rows — the CA task list
  is a fetch, not a content project), `dropsline` (**V9b answered**).
  `page_name` is on every bucket and is the only key that joins them.
- **`dropsline` has an unfilterable column.** `drop_json` is `"index": false` —
  selectable but **not** usable in a `where`. Filter by `item_name` and parse
  the JSON client-side.
- **Known-bad data to defend against:** `range_defence_bonus` is null on all
  3,234 monster rows; `infobox_bonuses` returns an all-zero duplicate row for
  degraded Barrows gear (a real row, not an error — pick the non-zero one).
- **Page-name traps:** imbued salve pages are `Salve amulet(i)` — no space
  before the bracket.
- **Item icon filenames are not derivable from item names.** `/mapping` carries
  an `icon` field for all 4,650 items and it is authoritative; **294 (6.3%)
  differ** from `<name>.png` — `Acorn` → `Acorn 5.png`, `Abyssal bracelet(5)` →
  `Abyssal bracelet.png`. Deriving instead of reading the field is 294 silent
  404s. Icons are also **trimmed to content, not gridded** (18×29 to 32×31
  against the game's 36×32 cell), which is why `ItemIcon` fixes the cell rather
  than the artwork.
- **Quest requirements are extractable** (V9 resolved). The `quest` bucket's
  prose embeds `<span class="scp" data-skill=… data-level=…>` markup, so skill
  requirements parse out of it despite the bucket being unstructured.
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

Full list: PRD §9.1. **Resolved: V1, V3, V9, V9b, V11, V14.** **V11a and V4 are
moot** — there is no auth and no RSN linking to verify (ADR-0012).

| #   | Question                                                | Blocks                                                         |
| --- | ------------------------------------------------------- | -------------------------------------------------------------- |
| V5  | WOM rate limits / stance on our anonymous read cadence  | Caching design                                                 |
| V10 | Does a cheap WOM **group-level** update endpoint exist? | Scheduled refresh                                              |
| V2  | TempleOSRS terms + API unread (403)                     | Collection log                                                 |
| V13 | Free-tier cron limits + hosting cost                    | [ADR-0006](./docs/adr/0006-hosting-tier-and-scheduled-jobs.md) |

**V3 answered:** GE tax is **2%** of sale price, capped at **5,000,000 gp per
item**, rounding down. Tax-free below 50gp is a _consequence_ of that rounding,
not a separate rule. 43 exempt items. Raised from 1% on 2025-05-29. Encoded once,
with provenance, in the Economy constants module.
**V9 / V9b answered:** see "Verified API facts" above.

---

## The auth module was deleted

`src/lib/auth/` (7 modules, 52 tests), the sign-in page, the Auth.js route and
the Discord verify script were removed when ADR-0012 landed, and are preserved
in commit **`5202810`**. If auth ever returns, recover rather than rewrite —
`git show 5202810:src/lib/auth/access.ts`. `decideAccess()` was mutation-tested.

## Built so far

| Module                        | Purpose                                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| `lib/api/osrs-fetch.ts`       | The only outbound chokepoint. User-Agent, per-source TTLs, `assertNoFanOut`        |
| `lib/api/wom-group.ts`        | Clan roster / `gained` leaderboards / competitions. Typed against the real payload |
| `lib/api/prices.ts`           | GE prices. Bulk `/latest` over per-item; `timestepForDays` enforces the 365 cap    |
| `lib/api/wiki-bucket.ts`      | Static game data. `buildBucketQuery` is the injection boundary — never concatenate |
| `lib/ratelimit/`              | `enforceRateLimit()` + shared Postgres counter. Store is swappable behind an iface |
| `lib/clan/ranks.ts`           | Rank ordering from `roleOrders`. Pure, no network — **no hardcoded ladder**        |
| `lib/utils/format-gp.ts`      | GP formatting; truncates towards zero so money is never overstated                 |
| `lib/utils/parse-quantity.ts` | Reads `1,000` / `13m` / `.5`. Shared core; each feature keeps its own limits       |
| `lib/navigation/tools.ts`     | Tool directory as data. A dead link **and** an unadvertised route fail a test      |

**Feature modules:** `lib/economy/`, `lib/combat/`, `lib/clues/`, `lib/utility/`,
`lib/skilling/`, `lib/quests/` — each owns its slice and its
`src/app/<feature>/` segment.

**Atoms:** `Button`, `Input`, `Select`, `Table` (+ cells), `PriceTag`,
`StatBadge`, `Icon`, `ItemIcon` — check
[`src/components/README.md`](./src/components/README.md) before writing a new
one; it carries a full per-slice inventory. **The labelled-field duplication is
resolved**: one `molecules/NumericField` and one `molecules/SelectField` replace
the five that six parallel agents wrote. Don't add a slice-local one.

**Two icon tiers, and they never mix.** `ItemIcon` is tier one: fixed-palette
game art, not tintable, so it can never carry state through colour, and it needs
`slotted` on dark surfaces. `Icon` is tier two — a `currentColor` glyph that
behaves like text. (ADR-0020). **The hand-drawn `Sprite` system is deleted**
(ADR-0023); recover from `77e990f` rather than redrawing if it is ever wanted.

**`ItemIcon` is wired into economy** — `ItemPriceTable`, `AlchProfitTable` and
`ItemOverview`, all `slotted`, all decorative (the link or heading beside each
one prints the name). Five of the 4,650 mapping ids have no packed artwork
because the icon file the mapping names 404s; `/economy/items/28220` is the
reachable example and renders the empty slot.

**`ItemIcon` takes an item id, not a name.** Real OSRS icons are rasters trimmed
to their content, so there is no grid to scale against — the _cell_ is fixed
(36px, `scale={1|2}`) and the artwork sits inside it. It renders an empty cell
for an id with no packed icon; **the set covers GE-tradeables only**, so coins,
clue scrolls, quest capes and diary rewards have no icon at all. Never point one
at the wiki. (ADR-0021, ADR-0022)

**The icon manifest's order is load-bearing.** An id's index in `ITEM_ICON_IDS`
**is** its cell in the atlas, so sorting or filtering that array without running
`npm run icons:pack` repoints every icon after the edit at the wrong item — and
that renders as artwork, not as an error. `item-icons.atlas.test.ts` reads the
committed pixels to catch it. (ADR-0022)

1133 tests. The escaping and IP-spoofing tests encode behaviour verified against
live APIs; `ranks.test.ts` uses the real Void Reavers `roleOrders` fixture.

## Next tasks

Full detail in [`HANDOFF.md`](./HANDOFF.md).

1. **Page-level layout and navigation** — the last ADR-0020 step. There is no
   global nav at all today; every page is reached from the landing page or a URL.
2. **Marble texture**, which needs the layout first. Never behind data.
3. **Roster page** over `sortByRank`/`groupByRank`, surfacing
   `player.updatedAt` so staleness is visible rather than implied.
4. **`pruneRateLimitCounters()` job** behind `CRON_SECRET`.

## CI

Four jobs: `quality` / `test` / `build` run in parallel, and a `ci` gate
job requires all three — **branch protection should require `ci` alone**, so a
job added later is covered the moment it joins `needs`.

- **Actions are pinned to commit SHAs**, never tags. `@v4` is mutable, and CI is
  where `CRON_SECRET` and `DATABASE_URL` will live. Keep the trailing `# v4.4.0`
  comment accurate when bumping; `.github/dependabot.yml` moves both together.
  **Never reintroduce a bare tag**, including in a new workflow.
- **CI lists the scripts individually rather than running `npm run check`.**
  `src/test/ci-workflow.test.ts` asserts the two cannot drift — add a step to
  `check` without adding it to CI and that test fails.
- **The `build` job runs with no secrets on purpose** — it is the regression
  test for hard rule #2. If it fails, something started reading env at import
  time. Fix the import; do not add secrets.
- **The `test` job runs a real Postgres service container**, same image digest
  as `docker-compose.yml`, and applies the migration before testing. That is
  what makes `postgres-store.live.test.ts` run rather than skip. Its env values
  are obvious fakes on purpose — never put a realistic secret in a public
  workflow. The suite **fails** if `CI` is set and no database is reachable, so
  deleting the service block cannot quietly reduce coverage.

## Built, but not wired up

- **`daily_snapshots` has no writer.** The table exists; nothing fills it.
- **`rate_limit_counters` has no pruning job.** Wants a `CRON_SECRET`-protected
  `pruneRateLimitCounters()`; nothing breaks without it, the table just grows.
- **The migration is applied _locally only_.** Any deployment starts from an
  unmigrated database, and `enforceRateLimit()` fails open until it is applied
  there — safe, but not rate limiting. `npm run db:migrate` reads `.env.local`
  via `node --env-file-if-exists`; drizzle-kit does not read it on its own.
- **Only `/api/health` and the two hiscores proxies touch Postgres.** No page
  does, which is why every route renders without a live database —
  `DATABASE_URL` need only _parse_ as a URL to satisfy `getEnv()`.
- **No clan/roster feature exists yet.** `wom-group.ts` and `ranks.ts` are
  tested but have no caller.

---

## When you make a decision

Write the ADR **in the same PR**, using the `write-adr` skill or
[`docs/adr/0000-template.md`](./docs/adr/0000-template.md). Add the index row.
Then update this file if it changes architecture, adds a data source, or
resolves an open question above.
