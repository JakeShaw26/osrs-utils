# Handoff — 2026-07-27

Snapshot for picking this up cold. **Living context is [`CLAUDE.md`](./CLAUDE.md)** —
read that first; this file covers what just happened and what to do next.

This replaces the Phase A handoff. Rewrite it again when Phase B closes.

> ## ⏸️ Resume point: **reboot the machine.**
>
> Docker Desktop and WSL are both installed; WSL needs a restart to activate,
> and a `CBS RebootPending` flag from the Docker install clears in the same
> reboot. After it: launch Docker Desktop, wait for the whale to settle, and
> confirm with `docker info` — it should print a server version.
>
> Everything that does **not** need a database is already done. Jump to
> [Next steps](#next-steps).

---

## Executive summary

**Phase B was the fan-out to six parallel feature agents. It is ~80% done in one
day.** Four of the six feature slices are merged to `main`, two are open and
blocked on a single missing dependency (a database), and the app went from
**zero user-facing features to 19 routes and 580 tests**.

The plan in the previous handoff held up. Six agents worked in isolated git
worktrees against a shared set of file-ownership rules, and **not one file was
touched by more than one branch** — merge order turned out to be free of
conflicts entirely, which is the strongest evidence the isolation rules were
right. What the plan did _not_ anticipate was that the parallel structure would
surface three corrections to our own documented facts, and one live security
defect. Those are the interesting part of the day and are detailed below.

**Three open questions were resolved as a side effect of building:** V3 (GE tax),
V9 (quest requirements are extractable), V9b (a drop-table bucket does exist).

**The one thing still not done is anything requiring a database.** On 2026-07-27
everything that does _not_ need one was cleared in PR #10 — the app was run and
walked for the first time, and the reconciliation pass landed apart from the two
items that genuinely depend on #4 and #6 merging. The database itself is one
reboot away. See [Next steps](#next-steps).

**Useful thing learned while unblocking it:** `DATABASE_URL` only has to _parse_
as a URL. `/api/health` is the only database consumer on `main`, so all 19 routes
render without a live Postgres — `getEnv()` validates the whole schema at once,
which is why an empty `.env.local` broke every page rather than only the
database-backed ones. That decoupling is what let the browser walk happen first.

---

## What shipped

`main` is at `a17a2ff`; PR #10 adds the reconciliation on top. **640 tests, 53
files** on that branch. `npm run check` green, secret-free `next build` green.

| Slice        | PR  | State     | Routes                                                        |
| ------------ | --- | --------- | ------------------------------------------------------------- |
| **Utility**  | #5  | ✅ merged | `/utility` + resets, prayer-flick, death-risk, minigames      |
| **Economy**  | #2  | ✅ merged | `/economy` + prices, items/[id], high-alch, flipping          |
| **Clues**    | #3  | ✅ merged | `/clues` + solver, combat-achievements, collection-log        |
| **Combat**   | #7  | ✅ merged | `/combat` + max-hit, dps, drop-rate                           |
| **Skilling** | #4  | 🔶 open   | `/skilling` + xp, methods, construction, agility, + API route |
| **Quests**   | #6  | 🔶 open   | `/quests` + planner, diaries, + API route                     |

Plus three infrastructure PRs:

| PR  | State     | What                                                           |
| --- | --------- | -------------------------------------------------------------- |
| #8  | ✅ merged | Fix: Economy pages were an open proxy (see below)              |
| #9  | 🔶 open   | Local Postgres via Docker Compose + a driver that can reach it |
| #10 | 🔶 open   | Phase B reconciliation + the route walk (2026-07-27)           |

### Also landed directly on `main` (not via PR)

Three changes went straight to `main` because every feature branch needed them
as a base, or because they were repo hygiene:

- **`f19361e` — UI test harness.** Vitest was node-only, `*.test.ts`, no DOM, so
  "unit test the UI" was impossible as configured. Two vitest **projects** split
  by extension: `.test.ts` on the fast node path, `.test.tsx` under jsdom.
  `Button.test.tsx` is the reference; [`docs/testing.md`](./docs/testing.md) is
  the contract. Landed before the agents so six of them did not each invent one.
- **`dfd9594` — ignore `.claude/worktrees/`.** The agent worktrees are full
  checkouts with their own `node_modules`. Lint walked all of them (33,088
  problems, none ours), and worse, the directory was **untracked rather than
  ignored** — a `git add -A` would have committed 3.5GB.
- This handoff rewrite.

---

## The four findings that matter more than the features

These are the reason to read this file rather than just the PR list.

### 1. 🔴 The Economy pages shipped as an open proxy (fixed, PR #8)

All four Economy pages declared `export const dynamic = 'force-dynamic'`. Next
documents that as equivalent to `fetchCache = 'force-no-store'`, which re-fetches
**"even if they provide a `'force-cache'` option"** — so it silently overrode
every TTL `osrsFetch` sets. Each page load re-fetched ~1MB from the Wiki,
uncached and unlimited: exactly the exposure of PRD §5.3 and hard rule #4, in the
one feature whose ADR was written to prevent it.

Nothing is deployed, so there was no live incident. **It was caught by reading
the build's route table, not by any test** — and no test in the suite could have
caught it. That gap is worth remembering.

Why it survived review: `force-dynamic` was solving a real, unrelated problem
(keeping `getEnv()` out of `next build`, which CI runs without secrets). It does
solve that. Its effect on fetch caching is a second consequence, and the comments
beside it asserted the opposite in good faith. **Confident prose next to a wrong
mechanism is harder to catch than no prose at all.**

Fixed with `fetchCache = 'default-cache'` on all four, plus `await connection()`
on `high-alch` (the only one with no request-time API to keep it out of the
build). A lint rule now rejects `force-dynamic` in any `page.tsx`/`layout.tsx`.
ADR-0014 keeps its decision and carries a `## Correction` section recording the
error rather than editing it away.

### 2. Our Bucket documentation was wrong — 47 buckets exist, not 4

The Clues agent probed the Bucket namespace. Verified independently against the
live API:

- **`Bucket:Combat achievement` exists** — structured rows (`id`, `name`,
  `monster`, `tier`). PRD §3.4's "hand-author the task list or drop the feature"
  is obsolete; only _completion_ is unavailable.
- **`Bucket:Dropsline` exists — V9b is answerable.** Schema: `item_name` (PAGE),
  `drop_json` (TEXT), `rare_drop_table` (BOOLEAN). **`CLAUDE.md` and this file
  both previously stated no drop-table bucket exists. That was wrong.** One
  caveat: `drop_json` is `"index": false`, so it can be selected but not
  filtered on — that constrains how a drop-table feature would query it.

### 3. The wiki contradicts itself on effective strength (Combat)

Two documented formulas disagree, and the difference is a **full point of max hit
on every maxed melee loadout**:

- `Maximum melee hit`: `⌊(level + style + 8) × prayer⌋`
- `Damage per second/Melee`: `⌊level × prayer⌋ + style + 8`

The wiki states F2P maxes at 31. Only the second reproduces it (verified
independently: the first gives 32). Without that single published outcome to
anchor on, this was a coin flip between two documented sources.

**Be honest about the DPS calculator's accuracy ceiling.** ADR-0007 forbids
reading the official calculator's GPL source for code _or_ values, so golden
tests are tiered: `[PUBLISHED]` (exactly one exists), `[GAME FACT]`, and
`[DERIVED]`. `[DERIVED]` cases prove we implement the documented formula — not
that the formula matches the game.

### 4. Local development needed a driver change, not just a database (PR #9)

`@neondatabase/serverless` does not speak the Postgres wire protocol; it sends
queries as HTTP to Neon's endpoint. **Installing Postgres locally was never going
to be sufficient.** `getDb()` now picks `node-postgres` for a loopback host and
Neon for anything else.

---

## Done on 2026-07-27 (PR #10)

Everything that did not require a database. Recorded here so it is not redone.

- **`.env.local` is populated and working** — it was 0 bytes, which is why
  `getEnv()` threw on every page. Not committed (gitignored); if it goes missing,
  regenerate from [`.env.example`](./.env.example).
- **Step 3, the browser walk, is done.** See [Route walk](#route-walk-findings).
- **Reconciliation items 1–5 and 8 are done.** Items **6 and 7** remain and are
  listed under [Next steps](#next-steps) — both genuinely need #4 and #6 merged.
- **Docker Desktop and WSL are installed.** Reboot pending.

### Route walk findings

All 19 routes return **200**, each with exactly one `<h1>`, and
`/economy/prices` fetched live data the OSRS Wiki accepted — the first live
upstream request this project has made. Three defects, all of which **render
fine and fail no test**:

1. **The landing page linked to six routes that do not exist** (`/tools/*`).
   Fixed, and the directory moved to `lib/navigation/tools.ts` as data so
   `tools.test.ts` can check every href against the filesystem.
2. **`CalculatorLayout`'s width override only worked in one direction.** `cn()`
   joins without merging, so `className="max-w-6xl"` shipped **both**
   `max-w-4xl` and `max-w-6xl`, leaving CSS source order to pick. Measured:
   `.max-w-2xl` (10940) < `.max-w-4xl` (10997) < `.max-w-6xl` (11111) — widening
   won by accident, narrowing was silently ignored. Now a `width` prop.
3. **`/` had no `<main>` landmark.** `layout.tsx` is `<body>{children}</body>`,
   so pages supply their own; the landing page used a bare `<div>`.

Heading rhythm was also drifting — `/` and `/economy` used `text-3xl` with no
mobile step-down while 13 other pages used `text-2xl sm:text-3xl`, so Economy's
heading was visibly larger on a phone. Normalised.

**The pattern worth carrying forward:** all three are _absences or accidents_,
not wrong logic — the same shape as the `force-dynamic` open proxy. The new
guards therefore read the **filesystem** and the **stylesheet**, not the
components. A guard that reads from the same source as the code it guards proves
nothing; a rendering test asserting `href="/tools/prices"` would have passed.

---

## Next steps

### 0. Reboot (blocks step 1 only)

WSL is installed but inactive until restart, and a `CBS RebootPending` flag from
the Docker install clears at the same time. Then launch Docker Desktop and check
`docker info` prints a server version.

> **Why Docker needed WSL at all:** Docker Desktop does not run containers
> directly on Windows — it runs a Linux VM, and WSL2 is its backend. With WSL
> missing it reports **"virtualization support not detected"**, which reads like
> a hardware fault and is not one. The CPU (Ryzen 5 5600H) and BIOS were fine
> throughout.

### 1. Database, then the two blocked PRs (~45 min)

```bash
npm run db:up        # waits for readiness, so the next line cannot race it
npm run db:migrate
npm run db:psql      # then \dt — expect rate_limit_counters
```

Merge **#9** first (`chore/local-postgres`) — it has the compose file _and_ the
driver fix. `@neondatabase/serverless` sends queries as HTTP to Neon's endpoint
and does not speak the Postgres wire protocol, so installing Postgres was never
going to be sufficient on its own.

`drizzle/0001_ordinary_multiple_man.sql` has **never been applied to any
database**. Until it is, `enforceRateLimit()` fails open on every call — safe,
but not rate limiting. That is exactly why **#4 `feat/skilling`** and **#6
`feat/quests`** are held back: both add `enforceRateLimit()`-gated anonymous
proxies to Jagex, and merging them first puts an unprotected one on `main`.

**Re-run `npm run check` after _each_ merge, not just at the end.** Both were
CI-green when opened, but `main` has moved a long way, and #4 and #6 have never
been tested against each other — they are the only two branches that both add
route handlers.

Full details: [`docs/local-database.md`](./docs/local-database.md).

### 2. Finish reconciliation (~30 min, needs step 1)

| #   | Item                                                                                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6   | **Promote `parse-quantity.ts`** from `lib/skilling/` to `lib/utils/`. Kept feature-local to avoid a five-way collision; Economy and Combat both want it. |
| 7   | **`src/components/README.md`** — inventory rows for the new components across all six slices.                                                            |

Also then: **ADR index rows for 0016 and 0018.** They are currently marked
_reserved, not missing_ in [`docs/README.md`](./docs/README.md) — the files exist
only on the two unmerged branches. Do not reuse those numbers.

Re-run the walk once `/skilling/*` and `/quests/*` land, and **add their routes
to `lib/navigation/tools.ts`** — `tools.test.ts` checks that every advertised
link resolves, but nothing forces a _new_ route to be advertised.

### 3. Then Phase B is closed — rewrite this file

### 4. Then pick from these

- **Pin CI actions to commit SHAs** rather than `@v4`. _(Carried over from the
  last three handoffs.)_ This is the only outstanding item that is a security
  issue rather than a feature: `@v4` is a **mutable** tag, so whoever controls
  the action can repoint it at code that runs in CI with access to `CRON_SECRET`
  and `DATABASE_URL`. Ten-minute change.
- **Roster page.** The highest-value thing not yet built: `sortByRank` /
  `groupByRank` over the WOM group, surfacing `player.updatedAt` so staleness is
  visible rather than implied. One request, no fan-out.
- **`pruneRateLimitCounters()` job**, behind `CRON_SECRET`. Nothing breaks
  without it; the table just grows.
- **Drop-table feature**, now that V9b is answerable (finding 2).
- **Index-page widths.** `/combat` and `/utility` sit at `max-w-4xl`, the rest at
  `5xl`. Left alone deliberately — those have two-column grids where narrower is
  defensible, so it is a judgement call rather than drift.

---

## Open questions

**Resolved this session: V3, V9, V9b.** Previously resolved: V1, V11, V14. Moot:
V11a, V4 (no auth, no RSN links).

| #   | Question                                 | Blocks            |
| --- | ---------------------------------------- | ----------------- |
| V5  | WOM stance on our anonymous read cadence | Caching design    |
| V10 | Cheap WOM group-level update endpoint?   | Scheduled refresh |
| V2  | TempleOSRS terms unread (403)            | Collection log    |
| V13 | Free-tier cron limits + hosting cost     | ADR-0006          |

**V3 answered:** GE tax is **2%** of sale price, capped at **5,000,000 gp per
item**, rounds down. Tax-free below 50gp is a _consequence_ of the rounding, not
a separate rule. 43 exempt items. Raised from 1% on 2025-05-29. Verified against
the Wiki 2026-07-26; encoded in one constants module with provenance.

---

## Gotchas — including new ones from this session

**New on 2026-07-27:**

- **`cn()` joins classes, it does not merge them** (deliberately — see
  `lib/utils/cn.ts`). Passing a `max-w-*` through `className` to a component that
  already sets one ships both, and **CSS source order decides, not argument
  order**. Tailwind emits utilities in ascending scale order, so overrides that
  widen appear to work and overrides that narrow are silently ignored. Prefer a
  named prop over a class when a component owns that property.
- **`getEnv()` validates the entire schema on first call**, so a page that
  touches nothing but the Wiki still requires `DATABASE_URL` to be present and
  parseable. All-or-nothing is intentional (fail loudly), but it means one
  missing variable breaks every route, not the related ones.
- **`app/layout.tsx` provides no `<main>`** — every page must render its own, or
  use `CalculatorLayout`, which does. `page-conventions.test.ts` enforces this.
- **Docker Desktop on Windows needs WSL2**, and says
  _"virtualization support not detected"_ when it is missing — which reads like
  a CPU/BIOS fault and usually is not. Check `wsl --status` before touching BIOS.

**New on 2026-07-26:**

- **`force-dynamic` is not a caching-neutral flag.** It disables the fetch data
  cache. Use `fetchCache = 'default-cache'` + `connection()`. Lint enforces this
  in pages; route handlers are exempt.
- **ESLint flat config: same-named rules replace, they do not merge.** Adding a
  page-scoped `no-restricted-syntax` block silently switched the bare-`fetch`
  guard off for every page. Both selectors are now listed in both blocks. **Test
  a new lint rule by writing code that should fail it.**
- **`URL.hostname` keeps the brackets on IPv6** — it returns `[::1]`, not `::1`.
- **`vi.useFakeTimers()` must narrow `toFake`** to `requestAnimationFrame` /
  `performance` in timer tests. Faking `setTimeout` makes every
  `await user.click()` hang, which presents as a broken component.
- **Agent worktrees are 3.5GB and were untracked.** Now ignored. `git worktree
list` to see them; they are disposable once their branches are pushed.

**Carried over, still true:**

- **`getEnv()` / `getDb()` inside functions, never module scope.**
- **Never concatenate a Bucket query** — the wiki parses `query` as a program.
  Use `buildBucketQuery()`. A bad query returns **HTTP 200** with an `error`
  field.
- **Bucket fields may be repeated arrays** — unwrap with `firstValue()`.
  Multi-version pages return multiple rows; that is data, not duplication.
- **`roleOrders` indices are sparse.** Compare them; never treat one as a
  position.
- **`gained` returns fewer rows than `memberCount`.**
- **Never call OSRS APIs with bare `fetch()`** — lint enforces it.

---

## A note on the parallel-agent experiment

Worth recording, because the next phase will face the same choice.

**What worked:** file-ownership rules produced **zero cross-branch conflicts**
across six branches and ~200 files. Landing the test harness on `main` _before_
the fan-out avoided six conflicting versions of it. Telling agents which shared
files were off-limits, and to report needed changes instead, worked — every one
complied, which is why step 4 exists as a clean list rather than a merge mess.

**What to do differently:** three agents independently built _mechanical
correctness checks_ into their data pipelines — an anagram must be a
rearrangement of its answer; the XP table recomputed from its formula; diary
levels required to agree across two encodings. That pattern was not in any brief
and caught real bugs in all three. **Ask for it explicitly next time.**

**The honest limitation:** every agent verified data and logic, none could
verify rendering, and the one defect that reached `main` was invisible to tests
and visible in the build output. Parallel agents scale code production, not
review.

**Confirmed on 2026-07-27.** The walk found three more defects, and every one was
an _absence_ — a missing route, a missing landmark, a missing merge in a class
joiner. None broke a test; all rendered fine. The generalisable fix is not "test
the UI more" but **make the guard read a different source than the code it
guards**: the filesystem for routes, the generated stylesheet for CSS
precedence. A test that reads the component can only confirm the component says
what it says.
