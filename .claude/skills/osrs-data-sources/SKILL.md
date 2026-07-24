---
name: osrs-data-sources
description: Choose and query the correct OSRS data source. Use whenever writing code that fetches OSRS game data — GE prices, item or monster stats, hiscores, player tracking, collection logs — or when deciding where a piece of game data should come from.
---

# OSRS data sources

Encodes decisions already made and verified for this project. Follow it instead
of reaching for whatever an OSRS API search turns up — **the popular answer is
actively wrong in at least one important case.**

## ⛔ Never use osrsbox-db

`osrsbox-db` is the top search result for "OSRS item database", is recommended
across forums and tutorials, and **its own README claims it is "updated after
every weekly game update."**

**Its last commit was 2021-09-30.** It is ~5 years stale.

Using it ships a database missing five years of items, bosses and gear. The
failure mode is **silently wrong answers**, not errors. Use Bucket instead.

> Before trusting any data source's freshness claim, check `pushed_at` via the
> GitHub API. Do not trust a README.

## Two standing policies

**API-first — copy no third-party code** (ADR-0007). Call APIs. Where none
exists, implement from published documentation and public game formulas, never
from another project's source. This is why the repo has no vendored calculator.

**⚠️ There is no DPS-calculation API.** The official wiki calculator is a
client-side app; `api.weirdgloop.org` serves data, not computation. DPS and max
hit are implemented in-house from published combat maths, with **mandatory
golden-file tests**. Every other feature is genuinely API-backed — DPS is the
sole exception, so don't go looking for an endpoint that isn't there.

**Compliance is binding** — see [`docs/api-terms.md`](../../../docs/api-terms.md)
(ADR-0011). Non-commercial, read-only, self-limiting, honestly identified, no
gameplay automation. Treat those rules like "don't commit secrets": if a task
seems to require breaking one, stop and flag it.

## Pick the source

| Need                                        | Source                | Notes                            |
| ------------------------------------------- | --------------------- | -------------------------------- |
| GE prices (live, history)                   | Wiki Real-time Prices | Only public source               |
| Alch values, buy limits                     | Prices `/mapping`     | Already there — no second call   |
| Item / monster stats                        | **Wiki Bucket API**   | Official, maintained             |
| Current levels, XP, boss KC, clues          | Jagex hiscores        | **Server-side only**             |
| Gains, trends, leaderboards, competitions   | **Wise Old Man**      | Never build snapshotting         |
| Collection log                              | TempleOSRS            | Unverified; partial, opt-in data |
| CAs, diaries, quest completion              | **none exist**        | Member-declared only             |
| Clue solutions, xp/hr rates, POH, minigames | authored content      | No API                           |

## Always route through `osrsFetch()`

`src/lib/api/osrs-fetch.ts` is the only place these hosts are called.

The Wiki **blocks default user agents** (`curl`, `python-requests`, `Java`, …)
and asks clients to identify themselves. Forgetting the header does not fail in
development — it gets the whole clan's IP blocked in production, later. The
wrapper also sets per-source cache TTLs and the WOM API key.

A lint rule blocks direct `fetch()` to these hosts.

## Constraints to design around

**Prices `/timeseries` caps at 365 points.** Range and granularity trade off:
`5m`→2.3 days, `1h`→15.3 days, `6h`→91.3 days, `24h`→364 days. **~1 year is the
ceiling.** Never promise multi-year charts.

**Hiscores send no CORS header.** Impossible from a browser. Server-side only —
`osrs-fetch.ts` is marked `server-only` so a client import is a build error.

**Hiscores lack CAs, diaries and quest data.** Verified across all 90 activity
names. Those features are member-declared, must be labelled as such, and must
never feed a ranked leaderboard.

**WOM allows 20 req/min** (100 with a key). At 500 members, a per-member loop is
~25 minutes. **Never fan out across members in a request path** — read
pre-aggregated data. `assertNoFanOut()` makes the mistake loud.

## Bucket: introspect before querying

Field names are **not guessable**. Verified wrong: `highalch`, `high_alch`,
`monster_name`. Verified right: `high_alchemy_value`, `name`.

```bash
curl --get "https://oldschool.runescape.wiki/api.php" \
  --data-urlencode "action=parse" \
  --data-urlencode "page=Bucket:Infobox monster" \
  --data-urlencode "prop=wikitext" --data-urlencode "format=json"
```

Query form:

```
bucket('infobox_item').select('item_name','item_id','high_alchemy_value')
  .where('item_name','Rune platebody').limit(1).run()
```

Gotchas: `item_id` is **repeated** (an array, not a scalar); multi-version pages
need `default_version` filtering or you get duplicate rows; `.select()` is
required.

## Caching (PRD §4.3)

| Source            | TTL                              |
| ----------------- | -------------------------------- |
| Prices `/latest`  | 60s, **shared across all users** |
| Prices `/mapping` | build-time / 24h (850KB)         |
| Bucket            | build-time — near-static         |
| Hiscores          | 5 min per RSN                    |
| WOM               | 5–15 min                         |

Our headroom with the Wiki is **goodwill, not contract**. Fetch in bulk once and
serve everyone from it; never per-item or per-user.

## Flag, don't guess

If you cannot confirm an endpoint, rate limit or field name, mark it
`[UNVERIFIED]` and add it to PRD §9.1 — including inside a _proposed fix_. A
mitigation resting on an unconfirmed capability is an unverified mitigation.

Details: `docs/api-notes/`.
