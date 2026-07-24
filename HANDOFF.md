# Handoff — 2026-07-24

Snapshot for picking this up cold. **Living context is [`CLAUDE.md`](./CLAUDE.md)** —
read that first; this file covers what happened in this session and what to do next.

Delete or rewrite this file once Phase A is done. A stale handoff is worse than none.

---

## Where we stand in one paragraph

The app pivoted from Discord-authenticated to **fully public and read-only**
(ADR-0012). The auth module was deleted; the clan layer is now sourced from the
Wise Old Man group API, which turned out to be richer than what auth provided.
Foundations are in place, pushed to GitHub with CI green. **No user-facing
feature exists yet.** Next up is Phase A: four shared foundations that must land
before feature work fans out to parallel agents.

---

## Repository state

- **Remote:** <https://github.com/JakeShaw26/osrs-utils> · branch `main` · in sync
- **CI:** `.github/workflows/ci.yml` — typecheck, lint, format, tests, build on
  push to `main` and every PR. Runs with **no secrets**, deliberately.
- **Tests:** 17 passing, 2 files. **Node 24.**
- **Clan:** Void Reavers, **WOM group `25092`**, 78 members (measured, not assumed).

### Commit history

| Commit    | What                                                           |
| --------- | -------------------------------------------------------------- |
| `5202810` | Scaffold + P0 Discord auth — **superseded**, kept for recovery |
| `1f4ba8b` | Remove authentication; public read-only app (ADR-0012)         |
| `5caf620` | WOM group client + clan rank ordering; resolved V14            |
| `95a87dd` | `.gitattributes`, line endings normalised to LF                |
| `6b3f34d` | CI workflow                                                    |

### What exists in `src/lib/`

| Module               | Purpose                                                                           |
| -------------------- | --------------------------------------------------------------------------------- |
| `api/osrs-fetch.ts`  | **The only outbound chokepoint.** User-Agent, per-source TTLs, `assertNoFanOut()` |
| `api/wom-group.ts`   | Clan roster, `gained` leaderboards, competitions. Typed from the observed payload |
| `clan/ranks.ts`      | Rank ordering from the group's own `roleOrders`. Pure, no network                 |
| `utils/format-gp.ts` | GP formatting; truncates toward zero so money is never overstated                 |
| `db/schema.ts`       | Two tables only: `daily_snapshots`, `job_state`                                   |
| `env.ts`             | **Lazy** `getEnv()` — never call at module scope                                  |

Nothing renders any of this yet. `src/app/page.tsx` is a token/component proof,
not a real landing page.

---

## What changed this session, and why

**The pivot.** The owner removed Discord login entirely — setup friction, not
wanting members to authorise a third-party app, wanting tools usable without
login, and not wanting a hard Discord dependency.

**The claim that made it work was verified before acting on it.** The owner said
clan data was available from other APIs. It is: WOM group endpoints return the
roster, the clan's own rank hierarchy, leaderboards and competitions
**anonymously, one request each**. Without that, this decision would have deleted
the clan layer rather than re-sourced it. Evidence is in
[`docs/api-notes/wise-old-man-groups.md`](./docs/api-notes/wise-old-man-groups.md).

**Deleted:** `src/lib/auth/` (7 modules, 52 tests), sign-in page, Auth.js route,
Discord verify script, `next-auth`. Schema went 14 tables → 2.

Git was initialised _before_ deleting, specifically so this is recoverable:

```bash
git show 5202810:src/lib/auth/access.ts    # mutation-tested; recover, don't rewrite
```

**Documented in:** ADR-0012 (new), ADR-0005 and ADR-0010 (marked superseded with
reasons), PRD §5 rewritten, §1.1/§3.8 revised, `CLAUDE.md`, `README.md`,
`docs/api-terms.md`.

---

## ⚠️ The one open security issue — read before writing any route

Removing auth **reopened a vulnerability the PRD had closed.**

PRD review finding M2: per-user rate limiting is meaningless for anonymous
traffic. The accepted fix was _"hiscores lookup requires login."_ **There is no
login now, so that fix is void**, and it applies to all traffic rather than an
edge case.

Any endpoint proxying an upstream API lets a stranger hammer Jagex or the Wiki
**from our IP**, and we get blocked — a direct breach of the self-limiting rule
in [`docs/api-terms.md`](./docs/api-terms.md).

**Nothing is exposed today** — no route proxies on demand yet. That changes with
the first one. This is why rate limiting is Phase A item 1.

Full write-up: PRD §5.3 and ADR-0012 "Bad" section.

---

## Phase A — next steps, in order

Shared foundations. **Do these sequentially, before fanning out to agents**, or
five agents will each invent their own price client.

### A1. Rate limiting — start here

Blocks everything that touches an upstream API on request.

**The trap to avoid (back-end naive):** an in-memory `Map` of IP → count. It
works perfectly on localhost and is silently useless in production, because each
serverless instance has its own memory — ten instances means ten separate
counters and ten times the intended limit. The state must be shared.

Constraints:

- Key by **IP**, since there is no user identity (that is the whole problem).
- Hosting is deferred (ADR-0006), so keep it **host-agnostic** — no Vercel-only
  primitive baked into call sites.
- Postgres already exists and has a `job_state` table precedent; a fixed-window
  or token-bucket counter there needs no new infrastructure. Upstash Redis is
  the faster option if a dependency is acceptable later.
- Put it behind a small interface so the backing store can change without
  touching routes.

Pair it with the other two controls from ADR-0012, which matter more than the
limiter itself: **a cache shared across all visitors**, and **scheduled
pre-aggregation** in preference to on-demand proxying. With no per-user
variation, one upstream fetch can serve everyone — caching is a security control
here, not a performance tweak.

### A2. Prices client — `src/lib/api/prices.ts`

On top of `osrsFetch('prices', …)`. Endpoints `/latest`, `/mapping`,
`/timeseries`. **`/timeseries` caps at 365 points** — 5m≈2.3d, 1h≈15.3d,
6h≈91.3d, 24h≈364d. ~1 year is the hard ceiling (ADR-0003); do not design a
multi-year chart. Details in `docs/api-notes/osrs-wiki-prices.md`.

### A3. Wiki Bucket client — static game data

**Introspect the schema first — field names are not guessable.** `highalch` and
`monster_name` are wrong; the real names are `high_alchemy_value` and `name`.
`infobox_monster` has 55 fields, enough for a full DPS calculator. See
`docs/api-notes/osrs-wiki-bucket.md`. Never use `osrsbox-db` (hard rule #8).

### A4. Shared atoms — `Input`, `Select`, `Table`

So parallel agents don't each write their own. Existing atoms: `Button`,
`PriceTag`, `StatBadge`. Semantic tokens only; see `docs/theming.md`.

---

## Phase B — parallel feature agents

Once A is done, feature groups are genuinely independent: Economy, Combat,
Skilling, Clues, Quests, Utility. Each owns `src/app/<feature>/` and
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
4. Each worktree needs its own `npm install` (546 MB) **and a copy of
   `.env.local`**, which is gitignored and therefore absent from a fresh
   worktree. The owner must provide it.

---

## Open questions

Resolved: V1, V11, V14. Moot: V11a, V4 (no auth, no RSN linking).

| #   | Question                                                | Blocks               |
| --- | ------------------------------------------------------- | -------------------- |
| V3  | Current GE tax rate, cap and exemptions — rules changed | Flipping calculator  |
| V5  | WOM stance on our anonymous read cadence                | Caching design (A1)  |
| V10 | Cheap WOM group-level update endpoint?                  | Scheduled refresh    |
| V2  | TempleOSRS terms unread (403)                           | Collection log       |
| V9  | Quest/equipment/drop-table buckets exist?               | Quests, gear compare |
| V13 | Free-tier cron limits + hosting cost                    | ADR-0006             |

---

## Owner action items

1. **Add `WOM_GROUP_ID="25092"` to `.env.local`**, and delete the
   `AUTH_DISCORD_*` / `DISCORD_GUILD_ID` lines — nothing reads them. If a
   throwaway Discord app was created for the abandoned V11a check, delete it.
2. **Pin CI actions to commit SHAs** rather than `@v4`. A mutable tag can be
   repointed at malicious code; this is a real supply-chain vector. Noted inline
   in `.github/workflows/ci.yml`.
3. Answer **V3** (GE tax) whenever convenient — it is the only thing blocking
   the highest-value feature group.

---

## Gotchas that will otherwise be rediscovered the hard way

- **`getEnv()` / `getDb()` inside functions, never at module scope.** Module
  scope runs during `next build` where secrets legitimately don't exist. This
  broke the build once already; CI's secret-free build step is the regression
  test.
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
