# Jagex OSRS Hiscores

**Endpoint:** `https://secure.runescape.com/m=hiscore_oldschool/index_lite.json?player=<rsn>`
**Verified:** 2026-07-24 — called live, response headers inspected.

## Response shape

```jsonc
{
  "name": "Lynx Titan",
  "skills": [
    { "id": 0, "name": "Overall", "rank": 114101, "level": 2278, "xp": 4600000000 },
    { "id": 1, "name": "Attack", "rank": 15, "level": 99, "xp": 200000000 },
    // 24 total
  ],
  "activities": [/* 90 total: bosses, clues, minigames */],
}
```

## ⚠️ No CORS headers — a backend is mandatory

The response carries **no `Access-Control-Allow-Origin` header** (verified by
inspecting headers directly). Browsers will block every direct call.

**A server-side proxy is not an optimisation; it is the only way this works.**
This single fact independently forces a backend (PRD §4.1).

## ⚠️ Coverage gaps — two features have no data source

All 90 activity names were enumerated and filtered for
`clue|achieve|diary|combat`. Only the seven clue entries matched.

| Data                      | Present?                                                          |
| ------------------------- | ----------------------------------------------------------------- |
| Skills (level/xp/rank)    | ✅ all 24                                                         |
| Boss KC                   | ✅                                                                |
| Clue scrolls              | ✅ `all`, `beginner`, `easy`, `medium`, `hard`, `elite`, `master` |
| **Combat Achievements**   | ❌ **absent**                                                     |
| **Achievement Diaries**   | ❌ **absent**                                                     |
| Quest points / completion | ❌ absent                                                         |
| Collection log            | ❌ absent                                                         |

Consequence: the CA tracker, diary tracker and quest tracker **cannot be
auto-populated**. They are member-declared, must be labelled as such, and must
not feed ranked leaderboards (PRD §3.4, §3.6).

## History

`index_lite.json` returns a point-in-time snapshot with no historical parameter.

Scoped honestly: **no known public Jagex endpoint provides history** — a single
positive test cannot prove a capability's absence across their whole surface.
Either way, history requires stored snapshots, which is why tracking is
delegated to Wise Old Man ([ADR-0002](../adr/0002-delegate-tracking-to-wise-old-man.md)).

## Rate limits

**Unverified.** Jagex publishes no documented limit. Community wrappers
self-impose ~100/min.

Assume a low limit and treat `429`/`403` as **expected**, not exceptional. Cache
per RSN (5 min default) and **require login for hiscores lookup** so per-user
rate limiting is possible — an anonymous proxy endpoint would let anyone hammer
Jagex from our IP (PRD §5.5).

## Terms of use

**Unverified — highest-priority legal check (PRD V1).** No Jagex document was
located that explicitly permits or forbids programmatic access. Large public
sites (Wise Old Man, TempleOSRS) operate openly and durably, so tolerance is
evidently high — but _tolerated_ is not _licensed_.

## Handling absent players

A player not on the hiscores is a **normal state**, not an error. Handle the
empty/404 response as "no data" in the UI rather than surfacing a failure.
