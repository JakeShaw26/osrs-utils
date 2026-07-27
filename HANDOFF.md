# Handoff — 2026-07-27 (evening)

Snapshot for picking this up cold. **Living context is [`CLAUDE.md`](./CLAUDE.md)** —
read that first; this file covers what just happened and what to do next.

This replaces the morning handoff, which ended at "reboot the machine".

> ## ⏸️ Resume point: **push `main`.**
>
> Everything below is committed **locally only** — `git log origin/main..main`.
> PRs #4, #6, #9 and #10 are still open on GitHub even though their content is
> merged here. Nothing else is blocked.
>
> Start Postgres first if it is not running: `npm run db:up`.

---

## Executive summary

**Phase B is complete.** All six feature slices are on `main` — **27 routes,
1058 tests** — and the two things that had never happened in this project both
happened today: a database exists, and the rate limiter has actually limited
something.

The reboot cleared the WSL activation, Docker came up, and the chain that had
been blocked since Phase B started fell over in about an hour: local Postgres →
migration applied → PRs #4 and #6 merged → routes walked.

**The migration was blocked by one undefined environment variable.** `.env.local`
is a Next.js convention, not a Node one, and `drizzle-kit` is a plain Node
process — so it never saw `DATABASE_URL_UNPOOLED` and reported
`url: undefined`. The database, the driver and the migration file had all been
correct and unapplied for two days because of that.

**The limiter now demonstrably works** — see [Proof](#proof-the-limiter-limits).
That mattered more than it sounds: `enforceRateLimit()` **fails open**, so a
broken query, a missing table and an unreachable database all produce the same
observable result as a working limiter. It had never been run against a real
table, and nothing in the suite would have noticed if it were broken.

---

## What shipped

`main` is ahead of `origin/main` and unpushed. `npm run check` green, `next
build` green, all 27 routes return 200.

| Slice        | PR  | State                 | Routes                                                   |
| ------------ | --- | --------------------- | -------------------------------------------------------- |
| **Utility**  | #5  | ✅ on `main`          | `/utility` + resets, prayer-flick, death-risk, minigames |
| **Economy**  | #2  | ✅ on `main`          | `/economy` + prices, items/[id], high-alch, flipping     |
| **Clues**    | #3  | ✅ on `main`          | `/clues` + solver, combat-achievements, collection-log   |
| **Combat**   | #7  | ✅ on `main`          | `/combat` + max-hit, dps, drop-rate                      |
| **Skilling** | #4  | ✅ merged **locally** | `/skilling` + xp, methods, construction, agility, + API  |
| **Quests**   | #6  | ✅ merged **locally** | `/quests` + planner, diaries, + API                      |

| PR  | State                 | What                                           |
| --- | --------------------- | ---------------------------------------------- |
| #8  | ✅ on `main`          | Fix: Economy pages were an open proxy          |
| #9  | ✅ merged **locally** | Local Postgres via Docker Compose + driver fix |
| #10 | ✅ merged **locally** | Phase B reconciliation + the first route walk  |

---

## Proof: the limiter limits

25 requests to `/api/skilling/hiscores`, one IP:

```
400 ×20, then 429 ×5
RateLimit-Limit: 20   RateLimit-Remaining: 0   Retry-After: 46
```

```
 bucket_key (truncated) | hits |      window_start
------------------------+------+------------------------
 20ZEbrzhPWKxQEeLNKuUyE |   26 | 2026-07-27 21:24:00+00
```

Two details worth keeping:

- **The test used an _invalid_ RSN on purpose.** The Skilling route rate-limits
  **before** validating, so an invalid name consumes budget and returns 400
  without ever touching Jagex — 25 requests, zero upstream traffic. The Quests
  route validates first, so the same test there would have hit Jagex 20 times.
  Skilling's order is the better one: it means malformed requests cannot be used
  to bypass the counter.
- **The bucket key is hashed**, not a raw IP. That is `bucketKeyFor()` doing its
  job (ADR-0013).

A new integration test now covers this permanently:
`src/lib/ratelimit/postgres-store.live.test.ts` — that `ON CONFLICT` increments
rather than overwrites, that a new window writes a new row, that **20 concurrent
increments return 1..20 with none lost**, and that pruning spares open windows.
It runs only when `DATABASE_URL` is loopback, so CI skips it. `npm run test:db`.

---

## The defect this session found

### 🔴 `feat/skilling` reintroduced the `force-dynamic` open proxy

`/skilling/methods` and `/skilling/construction` both declared
`dynamic = 'force-dynamic'`. That branch was cut **before** PR #8 fixed the
identical defect in Economy, so it arrived carrying it.

Same mechanism as before: `force-dynamic` is documented as equivalent to
`fetchCache = 'force-no-store'`, which overrode the TTLs `osrsFetch` sets on
`/mapping` (24h) and `/latest` (60s) — every anonymous page load re-fetching
~1MB from the Wiki instead of sharing one cache entry per TTL.

**The lint rule from PR #8 caught it**, on a branch written before the rule
existed. That is the rule paying for itself: no test failed, and both pages
render perfectly.

The comment beside the flag was, again, correct about something else —
`force-dynamic` genuinely was keeping the page out of `next build`, where there
is no `OSRS_API_USER_AGENT`. That is a real second problem and it is why the
flag survived review twice. It is now solved separately: `await connection()`
defers the render, `fetchCache = 'default-cache'` keeps the shared cache.
Confirmed in the build route table — both are `ƒ`, neither prerenders.

**Neither page reads `searchParams`, so `connection()` is required.** Without
it they prerender and fetch the GE during the build.

---

## Also done

- **Reconciliation item 6** — `parse-quantity.ts` promoted to `lib/utils/`.
  Skilling and Economy had written the same shorthand parser independently. Only
  the _parsing_ was shared; what each feature considers valid (GP truncates to
  whole coins, item counts cannot be fractional) stayed with the feature. The
  two regexes differed at the edges — Economy accepted a leading dot and
  stripped underscores, Skilling did neither — and the **union** was taken, not
  the intersection, so nothing that used to parse stopped parsing. Both cases
  are pinned by tests.
- **Reconciliation item 7** — `src/components/README.md` inventory, per slice.
  It also now records **known convergent duplication**: three near-identical
  numeric fields (`combat/NumberField`, `skilling/NumericField`,
  `quests/LevelField`) and two `SelectField`s. Nothing failed as a result, which
  is exactly why it needed writing down.
- **CI actions pinned to commit SHAs.** Carried over four handoffs, now done:
  `actions/checkout` and `actions/setup-node` are pinned to 40-character SHAs
  with the version in a trailing comment. Both SHAs were resolved from
  `git ls-remote` and cross-checked against the `v4.4.0` tags rather than
  recalled — a wrong trailing comment is worse than none, because it is the
  only readable half of the line.

  **`.github/dependabot.yml` was added in the same change.** Pinning alone
  trades a mutable-tag risk for a stale-action risk: a SHA never updates, so a
  pinned action silently stops receiving security patches and nothing fails to
  tell you. Dependabot bumps the SHA and the comment together, through review.

  Deliberately **not** upgraded to `v7`, which is current. Pinning and a major
  version bump are separate decisions with separate blast radii, and v5+ change
  the action runtime. Worth doing, separately, on purpose.

- **ADR index rows for 0016 and 0018** — no longer "reserved", both on `main`.
- **`/skilling` and `/quests` added to `lib/navigation/tools.ts`.** They shipped
  eight routes the landing page advertised nowhere, and every test stayed green:
  `tools.test.ts` checked that advertised links resolve, never that real routes
  are advertised. **The reverse assertion now exists** — and was verified to
  fail without the entries rather than assumed to work. It names all eight.
- **`npm run db:migrate` / `db:studio` / `test:db`** now go through
  `node --env-file-if-exists=.env.local`. Node 24 reads env files natively, so
  no `dotenv` dependency was added.

---

## Next steps

### 1. Push, and close the PRs (~10 min)

The four open PRs contain content already merged
locally, so closing them after the push is the tidy end state.

**The local merges were done with `git merge`, not through GitHub**, because
the PR-merge action was blocked in this session. If you would rather have the
merge commits GitHub generates, reset to `origin/main` and merge through the UI
instead — the content is identical either way.

### 2. Then pick from these

- **Roster page.** The highest-value thing not yet built: `sortByRank` /
  `groupByRank` over the WOM group, surfacing `player.updatedAt` so staleness is
  visible rather than implied. One request, no fan-out.
- **`pruneRateLimitCounters()` job**, behind `CRON_SECRET`. Nothing breaks
  without it; the table just grows.
- **De-duplicate the numeric field** across combat/skilling/quests. Touches five
  slices, so it is deliberate work, not a drive-by.
- **Drop-table feature**, now that V9b is answerable.
- **Deployment.** Nothing is deployed, and the migration is applied to the local
  database only. Whatever host is chosen starts from an unmigrated database.

---

## Open questions

Unchanged. **Resolved: V1, V3, V9, V9b, V11, V14.** Moot: V11a, V4.

| #   | Question                                 | Blocks            |
| --- | ---------------------------------------- | ----------------- |
| V5  | WOM stance on our anonymous read cadence | Caching design    |
| V10 | Cheap WOM group-level update endpoint?   | Scheduled refresh |
| V2  | TempleOSRS terms unread (403)            | Collection log    |
| V13 | Free-tier cron limits + hosting cost     | ADR-0006          |

---

## Gotchas

**New this session:**

- **`drizzle-kit` does not read `.env.local`.** Nor does any plain Node process
  — it is a Next.js convention. This is what blocked the migration for two days,
  and it presents as `url: undefined`, which reads like a broken config file.
- **PowerShell 5.1's `Get-Content` defaults to ANSI, not UTF-8.** A
  read-modify-write over a `.tsx` file containing em-dashes silently corrupts
  every one of them to `â€"`. Typecheck, lint **and** Prettier all passed on the
  corrupted files; only three UI tests asserting on `—` caught it. **Use the
  editor, not shell text substitution, on source files.**
- **PowerShell 5.1 mangles quotes passed to native commands.** `git commit -m`
  with a here-string containing `"` splits into pathspecs. Write the message to
  a file and use `git commit -F`.
- **The dev server must be stopped before `next build`** — both use `.next/`.

**Carried over, still true:**

- **`force-dynamic` is not a caching-neutral flag.** It disables the fetch data
  cache. Use `fetchCache = 'default-cache'` + `connection()`. Lint enforces this
  in pages; route handlers are exempt, and correctly so.
- **`cn()` joins classes, it does not merge them.** Passing a `max-w-*` through
  `className` ships both, and **CSS source order decides**. Prefer a named prop.
- **`getEnv()` validates the entire schema on first call** — one missing
  variable breaks every route, not the related ones.
- **`app/layout.tsx` provides no `<main>`** — every page renders its own.
  `page-conventions.test.ts` enforces it.
- **ESLint flat config: same-named rules replace, they do not merge.** Test a
  new lint rule by writing code that should fail it.
- **`URL.hostname` keeps the brackets on IPv6** — `[::1]`, not `::1`.
- **Never concatenate a Bucket query.** A bad query returns **HTTP 200** with an
  `error` field.
- **`roleOrders` indices are sparse**; **`gained` returns fewer rows than
  `memberCount`**.
- **Never call OSRS APIs with bare `fetch()`** — lint enforces it.

---

## What the parallel-agent experiment finally showed

Recorded across three sessions now, and the conclusion did not change — it
sharpened.

**Every defect that reached `main` from six parallel agents was an _absence_ or
an _accident_, never wrong logic.** A missing route, a missing landmark, a
missing merge in a class joiner, a flag whose second effect nobody traced. The
agents' domain logic was excellent: 1058 tests, and the three that independently
built mechanical correctness checks into their data pipelines caught real bugs.

**What caught the defects was never a test of the code.** It was the build's
route table, the filesystem, the generated stylesheet, a lint rule reading the
AST, and a live HTTP request. Every one of those reads a **different source**
than the code it guards.

The `force-dynamic` recurrence is the sharpest example: the same defect, in the
same shape, in a second slice — caught instantly the second time, because by
then a guard existed that did not depend on anyone re-reasoning about it. That
is the whole lesson. **A test that reads the component can only confirm the
component says what it says.**

The one still-unguarded thing: **nothing compares the six slices visually.**
They share a token system that has been walked route by route but never seen
side by side.
