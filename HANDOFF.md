# Handoff — 2026-07-26 (end of day)

Snapshot for picking this up cold. **Living context is [`CLAUDE.md`](./CLAUDE.md)** —
read that first; this file covers what just happened and what to do next.

This replaces the Phase A handoff. Rewrite it again when Phase B closes.

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

**The one thing that did not get done is anything requiring a database.** That
is now unblocked in code but not yet executed — see [Start here tomorrow](#start-here-tomorrow).

---

## What shipped

`main` is at `a17a2ff`. **580 tests, 51 files.** `npm run check` green, secret-free
`next build` green.

| Slice        | PR  | State     | Routes                                                        |
| ------------ | --- | --------- | ------------------------------------------------------------- |
| **Utility**  | #5  | ✅ merged | `/utility` + resets, prayer-flick, death-risk, minigames      |
| **Economy**  | #2  | ✅ merged | `/economy` + prices, items/[id], high-alch, flipping          |
| **Clues**    | #3  | ✅ merged | `/clues` + solver, combat-achievements, collection-log        |
| **Combat**   | #7  | ✅ merged | `/combat` + max-hit, dps, drop-rate                           |
| **Skilling** | #4  | 🔶 open   | `/skilling` + xp, methods, construction, agility, + API route |
| **Quests**   | #6  | 🔶 open   | `/quests` + planner, diaries, + API route                     |

Plus two infrastructure PRs:

| PR  | State     | What                                                           |
| --- | --------- | -------------------------------------------------------------- |
| #8  | ✅ merged | Fix: Economy pages were an open proxy (see below)              |
| #9  | 🔶 open   | Local Postgres via Docker Compose + a driver that can reach it |

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

## Start here tomorrow

### Step 1 — Get the database running (~20 min, blocks everything else)

This is the only thing standing between here and a finished Phase B.

1. **Install Docker Desktop.** The winget install failed on an interactive UAC
   prompt that a background process cannot accept, so run it yourself:

   ```
   winget install --id Docker.DockerDesktop --accept-source-agreements --accept-package-agreements
   ```

   Accept the prompt, then **launch Docker Desktop and wait for it to settle.**
   `docker info` should print a server version.

2. **Check out PR #9** (`chore/local-postgres`) — it has the compose file and the
   driver fix. Merge it, or work on the branch.

3. **Populate `.env.local`.** It is currently **0 bytes**. Copy from
   [`.env.example`](./.env.example); only four values are required and
   `WOM_GROUP_ID` is already correct. The database pair needs no editing:

   ```
   DATABASE_URL="postgresql://osrs:localdev@localhost:5432/osrs"
   DATABASE_URL_UNPOOLED="postgresql://osrs:localdev@localhost:5432/osrs"
   ```

   `CRON_SECRET` needs ≥16 chars; `OSRS_API_USER_AGENT` must describe the app and
   include contact info, or the Wiki blocks us.

4. **Start it and apply the migration:**

   ```bash
   npm run db:up        # waits for readiness, so the next line cannot race it
   npm run db:migrate
   npm run db:psql      # then \dt — expect rate_limit_counters
   ```

   `drizzle/0001_ordinary_multiple_man.sql` has **never been applied to any
   database**. Until it is, `enforceRateLimit()` fails open on every call —
   which is safe, but it is not rate limiting.

5. **Full details:** [`docs/local-database.md`](./docs/local-database.md).

### Step 2 — Merge the two blocked PRs (~30 min)

**#4 `feat/skilling`** and **#6 `feat/quests`** are the two that add
`enforceRateLimit()`-gated proxies to Jagex. They were deliberately held back:
merging them before the migration puts an unprotected anonymous proxy on `main`.
Once step 1 is done they are unblocked.

Both were CI-green when opened, but `main` has moved a long way since. **Expect
to re-run `npm run check` after each merge**, and note that #4 and #6 have never
been tested against each other — they are the only two branches that both add
route handlers.

### Step 3 — Look at it in a browser (~30 min, do not skip)

**Nobody has seen any of this rendered.** Every agent verified data and logic;
`.env.local` was empty, so `getEnv()` threw and no page could load. Four
independently-built feature UIs share a token system, but **visual consistency
has never been checked and no test covers it.**

```bash
npm run dev
```

Walk all 19 routes. Expect seams: heading rhythm, table density, empty-state
wording, spacing between the four slices.

### Step 4 — The reconciliation pass (~1–2 hrs)

Deliberately deferred so six agents would not collide on the same lines. Do it as
one PR **after** steps 1–2, because most items reference files that only exist
once everything is merged.

| #   | Item                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **ADR index rows for 0014–0019.** Six new ADR files exist with no index entry.                                                                                                                                                                                                                                                                                                                                        |
| 2   | **`src/app/page.tsx` links to `/tools/*`** — placeholder routes that do not exist. Real routes are `/economy/*`, `/combat/*`, `/clues/*`, `/utility/*`, and after step 2, `/skilling/*` and `/quests/*`. **The landing page is currently broken.**                                                                                                                                                                    |
| 3   | **`CLAUDE.md` "Verified API facts"** — the bucket list is wrong (see finding 2). Add: `range_defence_bonus` is null on all 3,234 monster rows; `infobox_bonuses` returns an all-zero duplicate row for degraded Barrows gear; imbued salve pages are `Salve amulet(i)`, no space; the `quest` bucket's prose embeds `<span class="scp" data-skill=… data-level=…>` markup, which is how requirements are extractable. |
| 4   | **`CLAUDE.md` "nothing renders any `lib/api` client"** — stale. Several features now do.                                                                                                                                                                                                                                                                                                                              |
| 5   | **Strike V3, V9, V9b** from the open-questions tables in `CLAUDE.md` and this file. Add settled-decision rows for ADR-0014…0019.                                                                                                                                                                                                                                                                                      |
| 6   | **Promote `parse-quantity.ts`** from `lib/skilling/` to `lib/utils/`. Kept feature-local to avoid a five-way collision; Economy and Combat both want it.                                                                                                                                                                                                                                                              |
| 7   | **`src/components/README.md`** — inventory rows for the new components across all six slices.                                                                                                                                                                                                                                                                                                                         |
| 8   | **Promote `combat_achievement`** into `BUCKETS` in `lib/api/wiki-bucket.ts` (declared locally by Clues to avoid a collision).                                                                                                                                                                                                                                                                                         |

### Step 5 — Then pick from these

- **Roster page.** The highest-value thing not yet built: `sortByRank` /
  `groupByRank` over the WOM group, surfacing `player.updatedAt` so staleness is
  visible rather than implied. One request, no fan-out.
- **`pruneRateLimitCounters()` job**, behind `CRON_SECRET`. Nothing breaks
  without it; the table just grows.
- **Pin CI actions to commit SHAs** rather than `@v4`. A mutable tag can be
  repointed at malicious code. _(Carried over from the last two handoffs — still
  not done.)_
- **Drop-table feature**, now that V9b is answerable (finding 2).

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

**New:**

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
review. Step 3 exists because of this.
