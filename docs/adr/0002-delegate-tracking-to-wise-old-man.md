# ADR-0002: Delegate player tracking to Wise Old Man

- **Status:** Accepted
- **Date:** 2026-07-24
- **Deciders:** PRD §2.5

## Context

The official hiscores expose **no history** — every gains, delta, trend,
leaderboard and competition feature therefore needs someone to store snapshots
over time.

Building that ourselves means: a cron pipeline, a time-series schema, backfill,
dead-account pruning, and **name-change handling** (the genuinely fiddly one —
RSNs are mutable and a rename silently orphans history).

Wise Old Man already implements all of it as a maintained product: tracking,
snapshots, gains over arbitrary periods, groups, competitions with auto-tracked
scoreboards, leaderboards and records.

**Verified during research:** MIT licensed, last commit 2026-07-24 (same day) —
actively maintained, not a hobby project in decline.
**Documented:** 20 requests / 60 seconds, raised to 100 with a free API key.

## Decision

**We will consume the Wise Old Man API as the system of record for player
tracking, gains, competitions and clan leaderboards, rather than building our
own snapshot pipeline.**

We will additionally store a **thin daily snapshot** of the few metrics our
leaderboards use, purely as outage insurance. This is not a mirror of WOM and
must not grow into one.

## Consequences

### Good

- Removes the single largest infrastructure component from scope.
- **Removes us from Jagex's rate limits for tracking entirely** — WOM sits
  between us and Jagex, which also reduces exposure to the unresolved ToS
  question (PRD §9.1/V1).
- Name-change handling comes free.
- Gains data enables better features than we would have built — e.g.
  time-to-goal using the member's _actual_ recent xp/hr rather than a generic rate.

### Bad

- **A third-party dependency for a whole feature group.** Mitigated by the thin
  local snapshot: an outage degrades the clan layer to stale, not empty.
- Their rate limit becomes our constraint (20–100/min), which forces aggressive
  caching and rules out any per-member fan-out on request.
- Their data model constrains ours — we render what they track.
- **Unverified:** WOM's ToS on a third-party app driving scheduled group
  updates. Must be confirmed before P3 (PRD §9.1/V5).

### Neutral

- MIT licensing means self-hosting is a viable escape hatch if WOM disappears.

## Alternatives considered

| Alternative                             | Why not chosen                                                                                                                                                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Own snapshot pipeline against Jagex** | Full control, no third-party risk. Rejected: it is the single biggest build item, puts us directly against an undocumented rate limit and an unresolved ToS question, and requires solving name changes ourselves. |
| **TempleOSRS as tracker**               | Similar service, but its data is opt-in plugin-sourced and therefore incomplete (PRD §2.6). Fine for collection log, wrong for core tracking.                                                                      |
| **Both, ours as primary**               | All the cost of building it plus a dependency. Worst of both.                                                                                                                                                      |
| **Self-host WOM from day one**          | Full control and MIT-permitted, but reintroduces the operational burden we are avoiding. Keep as a contingency.                                                                                                    |

## Revisit if

- WOM's ToS forbids our usage (V5).
- **V10 finds no cheap group-update endpoint**, making refresh impractical.
- WOM's maintenance stalls — then self-host rather than rebuild.
