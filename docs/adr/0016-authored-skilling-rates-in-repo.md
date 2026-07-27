# ADR-0016: Authored skilling rates live as versioned JSON in the repo, and are editable in the UI

- **Status:** Accepted
- **Date:** 2026-07-26
- **Deciders:** Skilling feature agent (Phase B)
- **Relates to:** [ADR-0007](./0007-api-first-no-code-redistribution.md) (implement from
  published formulas, copy nothing), [ADR-0011](./0011-third-party-api-compliance.md)
  (attribution), [ADR-0012](./0012-no-authentication-public-read-only.md) (no writes,
  no accounts)

## Context

The skilling tools need three kinds of number, and they behave very differently.

**1. Game constants.** The XP table, XP per lap on an Agility course, the plank
count for an oak larder. These are facts. There is no API for any of them
(PRD §3.3) and they change only when Jagex changes the game.

**2. Live market data.** Grand Exchange prices, already solved by
`lib/api/prices.ts`.

**3. Rates — xp/hr, marks/hr.** These are neither. PRD §3.3 states the problem
precisely: they are "authored estimates and inherently contentious", and it
warns that presenting them as facts means "every disagreement about rates
becomes a bug report."

That warning is the whole reason this ADR exists. A published xp/hr is not
wrong or right; it encodes assumptions about gear, diaries, attention and tick
efficiency that the reader cannot see. Two competent players will disagree by
30% and both be correct about their own play. Any design that treats one of
those numbers as authoritative has built a permanent argument into the product.

Three constraints narrowed the options:

- **There are no accounts and no public write path** (ADR-0012, hard rule #5).
  A "suggest a better rate" form is not buildable — it would be an anonymous
  write from an untrusted caller.
- **Rates need review.** A rate is a claim. Someone should be able to see who
  changed 40k/hr to 60k/hr, when, and on what evidence.
- **Rates go stale silently.** A game update changes a rate and nothing breaks;
  the number is simply wrong from then on, with no error to notice.

## Decision

**We will store every authored skilling rate as versioned JSON inside the
repository, require each one to carry a citation, and make every contentious
rate editable by the reader at runtime.**

Concretely:

1. **Rates live in `src/lib/skilling/data/*.json`**, never in the database.
   Each file carries a `version` and an `updated` date, both bumped on change.
2. **Every rate carries a `source`** — title, URL, retrieval date, and a `basis`
   of `wiki-guide` or `author-estimate`. `TrainingMethod['source']` is a
   required field, so a method cannot be added without one. A test enforces that
   nothing claims a `wiki-guide` basis without a `runescape.wiki` URL.
3. **The UI presents rates as assumptions, not facts.** The xp/hr column of the
   comparator is an editable input; typing your own number recalculates that row
   and marks it "edited". Each row links its source and shows the date it was
   read.
4. **Where a rate genuinely spans a range, we publish the range.** Agility
   courses store `{ low, high }` for xp/hr and marks/hr, and the table renders
   "40,000–60,000" rather than a midpoint.
5. **Game constants are held to a higher standard than rates.** The XP table is
   written out as literals and a golden-file test recomputes all 99 entries from
   the published formula, so neither encoding is trusted alone.

**No user's edits are persisted.** They live in component state for the session.
Anything longer-lived would be per-user server state, which ADR-0012 forbids.

## Consequences

### Good

- **A disagreement about a rate is a two-second edit, not a bug report** —
  exactly what PRD §3.3 asks for.
- **A rate change is a reviewable diff in a pull request.** In the database it
  would be an invisible `UPDATE` with no author, no date and no rationale.
- **Rates ship with the code that reads them.** There is no migration to run and
  no environment where the data and the code disagree.
- **Zero runtime cost and zero failure modes.** The JSON is bundled; the pages
  that need no prices (`/skilling/xp`, `/skilling/agility`) prerender as static
  and stay up even when every upstream we depend on is down.
- **Citations make staleness auditable.** "Retrieved 2026-07-26" on a rate is a
  fact a reviewer can act on; an uncited number is not.

### Bad

- **Correcting a rate needs a deploy.** A wrong number stays wrong until someone
  opens a PR. That is a real cost, and it is the price of reviewability — we
  judged an unreviewable number worse than a slow-to-fix one, for a clan tool
  edited a handful of times a year.
- **The data will rot, and nothing will alarm.** A game update silently
  invalidates a rate. The `updated` date and the per-rate retrieval date make
  this visible, but visible is not automatic.
- **Item names, not ids, key the price lookup.** Chosen deliberately — a wrong
  id fetches a real price for the wrong item and produces a confident wrong
  answer, whereas a wrong name shows "price unavailable". The cost is that a
  Jagex rename breaks a lookup that an id would have survived.
- **A reader's edits vanish on reload.** No accounts, nowhere to put them.

### Neutral

- Each JSON file needs its `version` bumped by hand; `data.test.ts` validates
  shape and citations but cannot tell whether a number is _true_.
- If rates ever need to change without a deploy, the honest route is a
  build-time fetch or a `CRON_SECRET`-authenticated job writing a cache — not a
  public write path.

## Alternatives considered

| Alternative                                       | Why not chosen                                                                                                                                                                                             |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rates in the database**                         | Loses code review, the thing that makes a contentious number defensible. Editing them needs either a public write path (forbidden — ADR-0012, hard rule #5) or an admin UI for accounts that do not exist. |
| **Fetch rates from the wiki at build time**       | The rates live in prose inside training guides, not in a Bucket — there is no structured field to query (V9, `docs/api-notes/osrs-wiki-bucket.md`). Scraping prose is fragile and drifts without warning.  |
| **Copy a rate table from an existing calculator** | Straightforward ADR-0007 violation. We call APIs or implement from published formulas; we do not vendor someone else's data.                                                                               |
| **Publish a single midpoint per rate**            | Precisely the false precision PRD §3.3 warns about. "48,000 xp/hr" reads as measured; "40,000–60,000, higher with the Kandarin diary" reads as what it is.                                                 |
| **Omit rates entirely; show only gp/xp**          | Halves the tool's usefulness. "How long will this take" is the question players actually ask, and refusing to estimate sends them to an external calculator that estimates with less honesty about it.     |
| **Compute the XP table at runtime**               | Would work, but a literal table is reviewable in a diff and immune to floating-point drift. The golden-file test gives us the formula's guarantee without the runtime dependence on it.                    |

## Revisit if

- Rates need updating more often than the app is deployed — the trade flips
  towards a build-time fetch or a scheduled job writing a cache.
- The wiki exposes xp/hr as structured Bucket data, removing the need to author
  it at all.
- Authentication is ever reintroduced (reversing ADR-0012), at which point
  per-user saved rate preferences become possible and worth having.
- More than one feature slice needs authored rate data, in which case the
  `source`/`RateRange` types and `costing.ts` should be promoted out of
  `lib/skilling/` into a shared module.
