# ADR-0003: Accept the 365-point price history ceiling

- **Status:** Accepted
- **Date:** 2026-07-24
- **Deciders:** PRD §3.1

## Context

The GE price graph feature implies arbitrary historical ranges. The OSRS Wiki
`/timeseries` endpoint is the only public source of GE price history.

Measured directly across all four timesteps:

| timestep | points | span         |
| -------- | ------ | ------------ |
| `5m`     | 365    | 2.3 days     |
| `1h`     | 365    | 15.3 days    |
| `6h`     | 365    | 91.3 days    |
| `24h`    | 365    | **364 days** |

The cap is a hard **365 data points** regardless of timestep, so granularity and
range trade off directly. **~1 year is the ceiling**, and fine granularity exists
only for very recent data.

The decision is time-sensitive: **history cannot be backfilled.** If we ever want
multi-year charts, snapshotting must start at launch, not when the feature is
requested.

## Decision

**We will offer exactly four ranges, mapped to the four timesteps: 2 days,
15 days, 90 days and 1 year.** No "all time" or multi-year option.

**We will not snapshot prices ourselves for the MVP.**

## Consequences

### Good

- No storage or cron cost for price history.
- The four ranges map 1:1 onto the API, so each is a single cached request.
- The UI cannot promise data that does not exist.

### Bad

- **Irreversible for past data.** Choosing not to snapshot now means multi-year
  history is unavailable _forever_, not merely delayed. This is the one
  consequence in this ADR that cannot be undone by changing our minds later.
- Long-term investment analysis is out of reach.
- Range options are dictated by the API rather than by what users might want.

### Neutral

- Daily snapshotting could start at any time; it just begins accruing history
  from that date. Cost would be modest (~4,000 tradeable items × 1 row/day).

## Alternatives considered

| Alternative                                | Why not chosen                                                                                                                                                                                                          |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Snapshot daily prices from launch**      | The only way to get multi-year history. Rejected for MVP: real storage and cron cost for a feature nobody has asked for, and P1 should not carry P4 speculation. Cheap to start later — the cost is only the lost past. |
| **Arbitrary ranges via stitched requests** | The 365-point cap is per request; stitching adds complexity and load for data that does not exist beyond a year anyway.                                                                                                 |
| **A third-party price-history service**    | None identified with better depth and comparable reliability.                                                                                                                                                           |

## Revisit if

- Members actually ask for longer history → start daily snapshots then, and be
  explicit that history begins from that date.
- The Wiki raises the point cap or adds a range parameter.
