# OSRS Wiki Real-time Prices API

**Base:** `https://prices.runescape.wiki/api/v1/osrs`
**Verified:** 2026-07-24 — endpoints called live, not read from docs.

## Endpoints

| Endpoint      | Returns                                    | Notes                                                                                                  |
| ------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `/latest`     | `{itemId: {high, highTime, low, lowTime}}` | Works bulk or with `?id=`. **Prefer bulk** — one fetch serves all users                                |
| `/mapping`    | Static item metadata                       | **849,840 bytes.** `id`, `name`, `examine`, `members`, `lowalch`, `highalch`, `limit`, `value`, `icon` |
| `/5m`, `/1h`  | Averaged high/low + volume                 | Optional `timestamp` for a specific block                                                              |
| `/timeseries` | Price history for one item                 | Requires `id` + `timestep` ∈ `5m`\|`1h`\|`6h`\|`24h`                                                   |

## The 365-point cap — the constraint that shapes the feature

`/timeseries` returns a hard maximum of **365 points** regardless of timestep, so
range and granularity trade off directly:

| timestep | points | span           |
| -------- | ------ | -------------- |
| `5m`     | 365    | **2.3 days**   |
| `1h`     | 365    | **15.3 days**  |
| `6h`     | 365    | **91.3 days**  |
| `24h`    | 365    | **364.0 days** |

**~1 year is the ceiling.** Multi-year charts are not buildable from this API.
See [ADR-0003](../adr/0003-price-history-depth.md).

## User-Agent is mandatory

The Wiki **pre-emptively blocks** default agents: `python-requests`,
`Python-urllib`, `Apache-HttpClient`, `RestSharp`, `Java`, and bare `curl`.

Send a descriptive UA with contact info:

```
osrs-clan-toolkit/1.0 (+https://<domain>; discord: <handle>)
```

Set via `OSRS_API_USER_AGENT` and applied centrally in
[`src/lib/api/osrs-fetch.ts`](../../src/lib/api/osrs-fetch.ts). **Never call these
hosts with bare `fetch()`** — a lint rule blocks it.

## Rate limits

The Wiki states it does **not** explicitly rate-limit, caches at multiple levels,
and reserves the right to block usage threatening stability ("multiple large
queries per second, sustained").

**Treat this as goodwill, not a guarantee.** Getting blocked affects the whole
clan's IP. Cache aggressively; never fan out per-item or per-user.

## Sample responses

```jsonc
// GET /latest?id=20997  (Twisted bow)
{"data":{"20997":{"high":1478143929,"highTime":1784912264,
                  "low":1476000000,"lowTime":1784913820}}}

// GET /mapping  (first element)
{"examine":"Fabulously ancient mage protection enchanted in the 3rd Age.",
 "id":10344,"members":true,"lowalch":20200,"limit":8,"value":50500,
 "highalch":30300,"icon":"3rd age amulet.png","name":"3rd age amulet"}
```

## Licensing

Wiki content is CC BY-NC-SA 4.0. Attribution required. **Unverified** whether the
non-commercial clause extends to API data — non-commercial use is safe, but this
likely forecloses monetisation (PRD V6).
