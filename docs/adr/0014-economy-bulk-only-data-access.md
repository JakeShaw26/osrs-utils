# ADR-0014: Economy reads only bulk price feeds, and renders on the server

- **Status:** Accepted — **amended 2026-07-26, see [Correction](#correction-force-dynamic-disabled-the-very-cache-this-adr-relies-on)**
- **Date:** 2026-07-26
- **Deciders:** Economy feature agent (Phase B); amended at merge review
- **Relates to:** [ADR-0013](./0013-rate-limiting-shared-store.md) (rate limiting),
  [ADR-0012](./0012-no-authentication-public-read-only.md) (no auth),
  [ADR-0003](./0003-price-history-depth.md) (price history depth),
  [ADR-0011](./0011-third-party-api-compliance.md) (self-limiting is binding)

**This ADR also records the answer to open question V3** (GE tax rate, cap and
exemptions) — see the final section.

## Correction: `force-dynamic` disabled the very cache this ADR relies on

**The original version of this ADR was wrong in a way that mattered, and the
error is recorded here rather than edited away, because the shape of it is more
instructive than the fix.**

The argument for omitting `enforceRateLimit()` (below) rests on the shared
response cache being the stronger defence. That argument is sound. But the
implementation shipped with `export const dynamic = 'force-dynamic'` on all four
Economy pages, and the Next.js docs state that `force-dynamic` is equivalent to:

> Setting the option of every `fetch()` request in a layout or page to
> `{ cache: 'no-store', next: { revalidate: 0 } }` … Setting the segment config
> to `export const fetchCache = 'force-no-store'`

and that `force-no-store`:

> forces all `fetch` requests to be re-fetched every request **even if they
> provide a `'force-cache'` option**

So `force-dynamic` silently overrode every TTL `osrsFetch` sets. There was no
shared cache. Each page load re-fetched roughly a megabyte from the Wiki, with
no rate limiter — **the exact open-proxy exposure this ADR was written to
prevent** (PRD §5.3, hard rule #4). Nothing was deployed, so there was no live
incident; the defect was caught reviewing the build output at merge.

**Why it survived review:** `force-dynamic` was reached for to solve a real and
unrelated problem — keeping `getEnv()` out of `next build`, which CI runs
without secrets (hard rule #2). It does solve that. Its effect on fetch caching
is a second, undocumented-at-the-call-site consequence, and the source comments
next to it asserted the opposite in good faith: _"the `osrsFetch` data cache
still shares every upstream fetch across all requests."_ Confident prose next to
a wrong mechanism is harder to catch than no prose at all.

**The fix**, applied across all four pages:

- `export const fetchCache = 'default-cache'` — honours the explicit
  `next: { revalidate }` that `osrsFetch` already sets, including for fetches
  discovered after a request-time API (which the default `'auto'` would not
  cache).
- `await connection()` on `/economy/high-alch` only — the one page reading no
  `searchParams`, so nothing else keeps it out of the build. It defers rendering
  to a real request **without touching fetch caching**, which is precisely the
  distinction `force-dynamic` fails to make.
- A lint rule (`eslint.config.mjs`) rejects `dynamic = 'force-dynamic'` in any
  `page.tsx`/`layout.tsx`, naming the replacement. Route handlers stay exempt —
  they are request-scoped by nature and `/api/health` must never be cached.

**The generalisable lesson:** in this codebase the render mode and the data
cache are not independent, and the page controls both. Any future page proxying
an upstream must state its caching intent explicitly; "it's a Server Component
so it's cached" is not true and was never true.

## Context

The Economy slice is the first feature in the app to call an upstream API on a
user-facing path, so it is the first place the open-proxy exposure described in
ADR-0013 becomes real rather than theoretical.

The obvious implementation of "search an item and show its price" is an API
route that takes a query and proxies the Wiki. With no authentication
(ADR-0012), every caller of that route is anonymous and untrusted, and the item
id or search term varies per request — so an attacker misses our cache on every
call and we make the outbound request, from our IP, at their chosen rate. The
realistic outcome is a quiet block by the Wiki that breaks the app for the whole
clan and breaches the self-limiting commitment in
[`docs/api-terms.md`](../api-terms.md).

ADR-0013 states the order of defence explicitly: **pre-aggregate, then cache,
then rate limit** — and warns that reaching for the limiter first usually means
step 1 was skipped. `enforceRateLimit()` existed with no callers; the tempting
move was to make this feature its first one.

Measured facts that shaped the answer (verified live 2026-07-26 against
`prices.runescape.wiki`):

- `/mapping` is a single response covering **4,591 items** (~850 KB), changing
  only on weekly game updates.
- `/latest` is a single response covering **4,454 priced items**.
- `/5m` is a single response covering **1,499 items** — only a third of priced
  items have traded recently, which is itself a signal the UI must show rather
  than hide.
- `/timeseries` is the **only** per-item endpoint, and returns a hard maximum of
  **365 points** (confirmed: 365 for a 24h whip series).

So three of the four endpoints this feature needs are bulk: one response serves
every item and every visitor.

## Decision

**We will build the Economy slice so that no user-facing request causes an
upstream request that scales with the user's input.**

Concretely:

1. **All item, price, alch and volume data comes from the three bulk feeds**
   (`/mapping`, `/latest`, `/5m`), fetched through `osrsFetch` and joined in
   `src/lib/economy/market.ts`. Upstream request volume is therefore a function
   of the cache TTL and nothing else — not of visitors, not of what they search
   for, not of how hard someone scripts us.
2. **Item search runs on the server, over the already-fetched mapping**, and is
   driven by a plain `<form method="get">`. There is no search API route and no
   client-side index. The URL is the state.
3. **Pages are Server Components.** The only `"use client"` boundary is
   `FlippingCalculator`, which must recompute as the user types. The 850 KB
   mapping never reaches a browser — `market.ts` is `server-only`, so a client
   import is a build error rather than a bundle regression.
4. **The four price-history ranges are links, not a client toggle** — each is a
   real URL the server renders.
5. **`/timeseries` is bounded rather than rate limited.** The item id is
   validated against `/mapping` before any history fetch, so an invented id 404s
   without reaching the Wiki; `range` resolves to one of exactly four timesteps,
   so no caller-supplied string reaches the upstream; and `osrsFetch` caches per
   (item, range).
6. **Economy pages declare `fetchCache = 'default-cache'`, never
   `dynamic = 'force-dynamic'`.** Prices change every minute, so a build-time
   snapshot would be stale on arrival, and prerendering would call `getEnv()`
   during `next build` where CI deliberately has no secrets. Those goals are met
   by request-time rendering (`searchParams`, or `connection()` where there is
   no other request-time API) — **not** by opting out of the data cache, which
   is what `force-dynamic` actually does. See [Correction](#correction-force-dynamic-disabled-the-very-cache-this-adr-relies-on).
7. **No `enforceRateLimit()` in this feature.** See below.

### Why the limiter is deliberately absent

This is the part most likely to be questioned in review, so it is recorded
explicitly.

**The original reasoning here was that reading request headers would opt these
pages out of cached rendering, so adding the limiter would trade line 2 of
ADR-0013's defence for line 3. That reasoning does not hold** — these pages read
`searchParams` and are rendered per request regardless, so there is no render
caching for the limiter to cost. It was also self-defeating as written, since
the `force-dynamic` it justified had already destroyed the cache it claimed to
protect.

The decision stands, on the argument that actually applies:

**Upstream cost here does not vary with the caller.** Every Economy page reads
the same three bulk feeds, cached by TTL (decision 1 and 6 above). Whether one
visitor loads a page or ten thousand requests arrive, the Wiki sees the same
handful of requests per TTL. A rate limiter caps _inbound_ requests to us; it is
the right tool when inbound volume translates into outbound volume. Here it does
not, so the limiter would add per-request database writes and a failure mode
(`degraded: true` when the store is down) while protecting an upstream that is
already insulated. Our own render cost is a separate concern, better handled by
an edge cache or platform limits than by a Postgres counter.

Two conditions would reverse this, and both should be treated as review
triggers: **(a)** any Economy route whose upstream cost varies per caller —
notably a new per-item proxy; **(b)** deployment somewhere without an edge cache
in front, where inbound volume becomes a cost problem even with upstream
insulated. **If anyone later adds an Economy API route that proxies on request,
that route needs `enforceRateLimit()` and this ADR does not exempt it.**

## Consequences

### Good

- **Upstream traffic is decoupled from inbound traffic.** Scripting our public
  URLs cannot increase the load we place on the Wiki. This is the strongest form
  of the ADR-0011 self-limiting commitment, not a best-effort one.
- **Everything is cacheable.** No per-user variation means one rendered response
  is valid for every visitor.
- **Near-zero client JavaScript.** Search, the price tables, the item page and
  the chart ship no JS at all; only the flipping calculator hydrates.
- **The chart has no dependency.** Geometry is pure functions in
  `lib/economy/chart.ts`, unit-tested for axis rounding, gap handling and label
  collision without rendering.
- **Search works with JavaScript disabled**, and every result is a shareable URL.

### Bad

- **Search costs a round trip.** A client-side typeahead would feel faster. It
  would also mean shipping ~850 KB of item JSON to every visitor, which is worse
  on every axis except perceived latency for the second keystroke onward.
- **Range switching is a page navigation**, not an instant redraw.
- **Every request re-renders.** These pages are request-time by construction, so
  the server re-runs a linear search over 4,591 items per query. At ≤50 DAU this
  is irrelevant; at internet scale it would not be. Note this is a cost in _our_
  compute only — upstream traffic stays bounded by TTL.
- **The chart's hover layer is native `<title>` tooltips**, which are
  browser-styled and appear after a delay. A custom crosshair would read better
  but requires client JS on every item page.
- **`mostTradedRows` can only rank the ~1,499 items present in `/5m`.** Items
  that have not traded in the last five minutes cannot appear in the default
  list. This is correct behaviour but it is a consequence, not a coincidence.

### Neutral

- `src/lib/economy/` is now the pattern other feature slices can copy: pure
  domain logic, a `server-only` data-joining module, presentational components.
- The `/5m` coverage gap (1,499 of 4,454) makes the `unknown` liquidity state
  common rather than exceptional, so it is a first-class UI state.

## Alternatives considered

| Alternative                                                | Why not chosen                                                                                                                                                                                                 |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| An `/api/economy/search` route proxying the Wiki per query | The exact open-proxy shape ADR-0013 exists to prevent. The item id varies per request, so an attacker misses the cache every time.                                                                             |
| The same, but wrapped in `enforceRateLimit()`              | Treats the third line of defence as the first. Also fails open on a store outage, so the protection disappears exactly when the database is already unhealthy.                                                 |
| Client-side typeahead over the full item mapping           | Ships ~850 KB of JSON to every visitor to save a round trip, and puts a `server-only` module's data in a browser.                                                                                              |
| A `daily_snapshots`-style pre-aggregation job for prices   | Correct for clan data, wrong here: prices change per minute and the upstream feed is already a single bulk response. A job would add a database dependency and staleness for no reduction in upstream traffic. |
| Adding a charting library (Recharts, Chart.js)             | Would be the largest thing in the bundle for one line chart over ≤365 points, and Phase B agents may not add dependencies.                                                                                     |
| Rendering the chart client-side with a JS hover layer      | Costs a client bundle on every item page for a nicer tooltip. Native `<title>` is free, works before hydration, and is exposed to assistive tech.                                                              |
| Offering a "5 year" or "all time" price range              | The data does not exist — `/timeseries` caps at 365 points (ADR-0003). Offering it would silently mislabel 364 days of 24h data.                                                                               |

## Open question V3 — resolved: GE tax rate, cap and exemptions

V3 asked for the current Grand Exchange tax rules, flagged `[UNVERIFIED]` in the
PRD because they have changed more than once.

**Verified 2026-07-26** against the OSRS Wiki, "Grand Exchange" →
[_Convenience fee and item sink_](https://oldschool.runescape.wiki/w/Grand_Exchange)
(the `Grand Exchange tax` page is a redirect into that section):

| Rule               | Value                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| Tax rate           | **2%** of the sale price                                                                                 |
| Cap                | **5,000,000 gp per item** — per item, not per transaction or stack                                       |
| Rounding           | **Rounds down** to the nearest coin                                                                      |
| Tax-free threshold | Below **50 gp**, as a consequence of rounding down (2% of 49 = 0.98 → 0)                                 |
| Exempt items       | **43 named items** — bonds, low-level food, starter tools, common teleports and charged travel jewellery |
| History            | Introduced at 1% on 2021-12-09; **raised to 2% on 2025-05-29**                                           |

The PRD's assumption of "2% on sales above 50gp, capped per item" was correct in
shape. The specific cap value was unstated, and the exempt list was unknown.

Two details worth recording because they are easy to get wrong:

- **The 50 gp threshold is derived, not a separate game rule.** It falls out of
  rounding down. `GE_TAX_FREE_BELOW` is computed from the rate rather than
  hardcoded, so a future rate change moves it automatically.
- **The exempt list names specific charged variants** — `Ring of dueling(8)` is
  exempt, and the wiki does not list `(7)`. Since charge variants have different
  item ids, we match the wiki's list exactly rather than normalising the suffix
  away.

All of this lives in **one module**, `src/lib/economy/ge-tax.ts`, with the source
and verification date in the file header, as the PRD requires. No tax number
appears at a call site. `ge-tax.test.ts` pins the rate, the cap, the threshold
boundary (49/50/51), the cap boundary (249,999,999 / 250,000,000 / above) and
the exempt-variant behaviour, so a silent change fails the build.

## Revisit if

- **Jagex changes the tax again.** Re-verify against the wiki and update
  `ge-tax.ts` plus its tests; nothing else should need to change.
- **An Economy route needs to proxy an upstream per request** — that route needs
  `enforceRateLimit()`, and this ADR does not exempt it.
- **The Wiki adds a search endpoint**, which would make server-side search over
  the full mapping unnecessary.
- **Traffic stops being ≤50 DAU**, at which point `force-dynamic` re-rendering a
  4,591-item search per request is worth replacing with a cached index.
- **`/timeseries` raises its 365-point cap**, which would reopen ADR-0003 and
  the fixed four ranges with it.
