import { describe, expect, it } from 'vitest';
import { TIMESERIES_SPAN_DAYS, type Timestep } from '@/lib/api/prices';
import {
  DEFAULT_RANGE_ID,
  PRICE_RANGES,
  resolveRange,
  timestepForRange,
} from './price-ranges';

/**
 * ADR-0003 as a test.
 *
 * `/timeseries` returns at most 365 points whatever the timestep, so each
 * timestep reaches exactly one distance back and the ranges ARE the timesteps.
 * A fifth range could only exist by silently mislabelling one of these four.
 */
describe('PRICE_RANGES', () => {
  it('offers exactly the four ranges the 365-point cap allows', () => {
    expect(PRICE_RANGES.map((range) => range.id)).toEqual(['2d', '15d', '90d', '1y']);
  });

  it('maps each range to a distinct timestep', () => {
    const timesteps = PRICE_RANGES.map((range) => range.timestep);

    expect(timesteps).toEqual<Timestep[]>(['5m', '1h', '6h', '24h']);
    expect(new Set(timesteps).size).toBe(4);
  });

  // The measured spans live in lib/api/prices.ts. Restating them here would let
  // the two drift apart silently, so they are asserted equal instead.
  it('uses the measured span of each timestep, not a rounded label', () => {
    for (const range of PRICE_RANGES) {
      expect(range.days).toBe(TIMESERIES_SPAN_DAYS[range.timestep]);
    }
  });

  // Same cap, encoded from the opposite direction. If timestepForDays and this
  // table ever disagree, one of them is wrong about the API.
  it('agrees with timestepForDays about which timestep covers each range', () => {
    for (const range of PRICE_RANGES) {
      expect(timestepForRange(range)).toBe(range.timestep);
    }
  });

  it('offers no range beyond one year, because the data does not exist', () => {
    const longest = Math.max(...PRICE_RANGES.map((range) => range.days));

    expect(longest).toBeLessThanOrEqual(365);
  });
});

describe('resolveRange', () => {
  it('resolves each valid id', () => {
    expect(resolveRange('2d').timestep).toBe('5m');
    expect(resolveRange('90d').timestep).toBe('6h');
    expect(resolveRange('1y').timestep).toBe('24h');
  });

  // `?range=` is user-editable, and the resolved timestep goes into an outbound
  // request. Falling back is what keeps an arbitrary string from reaching the
  // upstream as a query parameter.
  it('falls back to the default for anything unrecognised', () => {
    expect(resolveRange(undefined).id).toBe(DEFAULT_RANGE_ID);
    expect(resolveRange('').id).toBe(DEFAULT_RANGE_ID);
    expect(resolveRange('all-time').id).toBe(DEFAULT_RANGE_ID);
    expect(resolveRange('5 years').id).toBe(DEFAULT_RANGE_ID);
    expect(resolveRange('../../etc/passwd').id).toBe(DEFAULT_RANGE_ID);
  });

  // Next.js gives an array when a param is repeated: ?range=2d&range=1y
  it('takes the first value when the param is repeated', () => {
    expect(resolveRange(['2d', '1y']).id).toBe('2d');
    expect(resolveRange([]).id).toBe(DEFAULT_RANGE_ID);
  });
});
