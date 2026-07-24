# Wise Old Man — group endpoints

**Verified:** 2026-07-24, against public group `82` (KnightSlayer, 488 members).
**Base:** `https://api.wiseoldman.net/v2`
**Docs:** <https://docs.wiseoldman.net>

These endpoints carry the entire clan layer ([ADR-0012](../adr/0012-no-authentication-public-read-only.md)),
so their behaviour is recorded rather than recalled.

---

## No authentication required — [VERIFIED]

All four calls below were made with **no API key and no credentials**, sending
only a compliant `User-Agent`. All returned `200`.

The optional `WOM_API_KEY` raises the rate limit from 20 to 100 req/min. It is
**headroom, not a requirement** — nothing here needs it to function.

| Endpoint                                  | Status | Bytes  | Notes                                    |
| ----------------------------------------- | ------ | ------ | ---------------------------------------- |
| `GET /groups?limit=3`                     | 200    | small  | Group search, anonymous                  |
| `GET /groups/{id}`                        | 200    | 283 KB | **Entire roster in one response**        |
| `GET /groups/{id}/competitions`           | 200    | 127 KB | 150 competitions returned                |
| `GET /groups/{id}/gained?metric=&period=` | 200    | 258 KB | 485 ranked rows — a finished leaderboard |

---

## `GET /groups/{id}` — [VERIFIED]

Top-level keys:

```
id, name, clanChat, description, homeworld, verified, patron, visible,
profileImage, bannerImage, score, createdAt, updatedAt, memberCount,
socialLinks, roleOrders, memberships
```

### `memberships[]` — the roster

`memberships.length === memberCount` (488 === 488): **the full roster arrives in
one request, not paginated.** This is why hard rule #4 (no fan-out) is satisfied
by construction for clan views.

Each membership: `playerId, groupId, role, clientSyncJoinedAt, createdAt, updatedAt, player`

`membership.player` embeds:

```
id, username, displayName, type, build, status, country, patron,
exp, ehp, ehb, ttm, tt200m, registeredAt, updatedAt, lastChangedAt, lastImportedAt
```

**Consequence:** a total-XP, EHP or EHB leaderboard needs **zero additional
requests** — sort the array you already have.

`player.updatedAt` is per-player staleness. Surface it; do not imply a freshness
the data does not have.

### `roleOrders` — the clan's own rank hierarchy

```json
[
  { "groupId": 82, "role": "owner", "index": 0 },
  { "groupId": 82, "role": "deputy_owner", "index": 1 },
  { "groupId": 82, "role": "moderator", "index": 3 }
]
```

**Never hardcode a rank ladder.** Read this instead: the clan can reorder its
own ranks without a code change, and different groups order them differently.

Note the indices are **not contiguous** (the observed group skipped 6, 8 and
11). Sort by `index`; never treat it as an array position or assume density.

Roles observed on group 82 (24 distinct) are real OSRS clan ranks:

```
owner, deputy_owner, coordinator, moderator, teacher, recruiter, enforcer,
admiral, brigadier, diamond, colonel, slayer, skiller, gold, commander,
officer, dragonstone, general, captain, lieutenant, sergeant, corporal,
recruit, gnome_child
```

A role present on a membership but **absent from `roleOrders`** is possible;
treat unknown roles as unranked rather than crashing.

---

## `GET /groups/{id}/gained` — [VERIFIED]

Query: `?metric=overall&period=week&limit=n`

Row shape: `{ player, startDate, endDate, data: { gained, start, end } }`

Returned 485 rows for a 488-member group — **not every member appears**, so
never assume roster count equals leaderboard count, and never index one by the
other.

---

## `GET /groups/{id}/competitions` — [VERIFIED]

Row keys: `id, title, type, startsAt, endsAt, groupId, score, visible,
createdAt, updatedAt, metric, metrics, participantCount, group`

Both `metric` (singular) and `metrics` (plural) exist — `type` was `"classic"`
on the sampled row. Check `type` before assuming which applies.

---

## Operational rules

1. **Cache server-side, shared across all visitors.** 283 KB per page view is
   not acceptable and would breach the self-limiting rule in
   [`api-terms.md`](../api-terms.md). With no per-user variation
   (ADR-0012) one fetch can serve everyone.
2. **Prefer scheduled refresh over on-demand fetching**, so our upstream request
   rate stays constant regardless of our traffic.
3. **Rate limit:** 20 req/min anonymous. Comfortable, but only if we are not
   fetching per visitor.

## Not verified — [UNVERIFIED]

- Whether `memberships` stays unpaginated for groups **larger** than ~500. Our
  clan is within the tested range, so this is not currently a risk.
- Rate-limit response headers and `429` behaviour under sustained load.
- Whether WOM objects to a scheduled read cadence (**open question V5**).
