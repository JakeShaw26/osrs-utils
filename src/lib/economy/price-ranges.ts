import { timestepForDays, type Timestep } from '@/lib/api/prices';

/**
 * The four price-history ranges — and there are exactly four, permanently.
 *
 * This is ADR-0003 expressed as data. `/timeseries` returns at most 365 points
 * whatever timestep you ask for, so each timestep reaches exactly one distance
 * back and the ranges ARE the timesteps. Offering "6 months" would silently
 * serve 91 days of `6h` data or 364 days of `24h` data, neither of which is six
 * months, and the user would have no way to tell.
 *
 * There is no "all time". ~1 year is the ceiling of the data that exists.
 */

export type RangeId = '2d' | '15d' | '90d' | '1y';

export interface PriceRange {
  id: RangeId;
  /** Shown on the range switcher. */
  label: string;
  /** The upstream timestep this range maps to. */
  timestep: Timestep;
  /** Days of history the range actually covers, measured (docs/api-notes). */
  days: number;
  /** Granularity, for the "one point per ..." caption under the chart. */
  pointDescription: string;
}

export const PRICE_RANGES: readonly PriceRange[] = [
  {
    id: '2d',
    label: '2 days',
    timestep: '5m',
    days: 2.3,
    pointDescription: '5 minutes',
  },
  {
    id: '15d',
    label: '15 days',
    timestep: '1h',
    days: 15.3,
    pointDescription: 'hour',
  },
  {
    id: '90d',
    label: '90 days',
    timestep: '6h',
    days: 91.3,
    pointDescription: '6 hours',
  },
  {
    id: '1y',
    label: '1 year',
    timestep: '24h',
    days: 364,
    pointDescription: 'day',
  },
] as const;

export const DEFAULT_RANGE_ID: RangeId = '15d';

/**
 * Resolves a range from an untrusted URL search param.
 *
 * Falls back to the default rather than throwing: `?range=` is user-editable
 * and a typo should show a chart, not a 500. It must never be passed through
 * to the upstream unchecked — that would let a caller choose an arbitrary
 * `timestep` value on our outbound request.
 */
export function resolveRange(id: string | string[] | undefined): PriceRange {
  const wanted = Array.isArray(id) ? id[0] : id;
  return (
    PRICE_RANGES.find((range) => range.id === wanted) ??
    PRICE_RANGES.find((range) => range.id === DEFAULT_RANGE_ID) ??
    // Unreachable: DEFAULT_RANGE_ID is one of the four. Kept as a total
    // expression so the return type is PriceRange rather than PriceRange | undefined.
    PRICE_RANGES[0]!
  );
}

/**
 * Cross-check that our hand-written table agrees with `timestepForDays`.
 *
 * The two encode the same 365-point cap from opposite directions, and this is
 * where they are asserted to match — see price-ranges.test.ts. Exported so the
 * test uses the real function rather than restating the mapping a third time.
 */
export function timestepForRange(range: PriceRange): Timestep {
  return timestepForDays(range.days);
}
