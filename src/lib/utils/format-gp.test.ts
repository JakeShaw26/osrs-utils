import { describe, it, expect } from 'vitest';
import { formatGp, formatGpExact } from './format-gp';

/**
 * Every GP figure in the app renders through formatGp, so a bug here is visible
 * on every screen at once and is the kind of thing players notice immediately —
 * a margin shown as "2m" when it is 1,999,999 reads as a different trade.
 */

describe('formatGp', () => {
  it('picks the unit at each boundary', () => {
    expect(formatGp(999n)).toBe('999');
    expect(formatGp(1_000n)).toBe('1k');
    expect(formatGp(999_999n)).toBe('999.9k');
    expect(formatGp(1_000_000n)).toBe('1m');
    expect(formatGp(1_000_000_000n)).toBe('1b');
  });

  it('drops a trailing .0 rather than printing "1.0m"', () => {
    expect(formatGp(2_000_000n)).toBe('2m');
    expect(formatGp(2_100_000n)).toBe('2.1m');
  });

  /**
   * The important one. Truncating means a value BELOW a threshold can never
   * display AS that threshold: 1,999,999 gp shows "1.9m", not "2m". Rounding
   * would overstate what a player is holding or about to earn, and overstating
   * money is the worst direction to be wrong in.
   */
  it('truncates towards zero instead of rounding up', () => {
    expect(formatGp(1_999_999n)).toBe('1.9m');
    expect(formatGp(1_950_000n)).toBe('1.9m');
    expect(formatGp(999_999_999n)).toBe('999.9m');
  });

  it('handles losses symmetrically', () => {
    expect(formatGp(-1_400_000_000n)).toBe('-1.4b');
    expect(formatGp(-999n)).toBe('-999');
    expect(formatGp(0n)).toBe('0');
  });

  /**
   * The reason the signature takes bigint at all. Total clan GP and max-cash
   * stacks exceed Number.MAX_SAFE_INTEGER (~9.007e15); a number-based
   * implementation silently loses precision here rather than failing.
   */
  it('stays exact beyond Number.MAX_SAFE_INTEGER', () => {
    expect(formatGp(9_007_199_254_740_993n)).toBe('9007199.2b');
    expect(formatGpExact(9_007_199_254_740_993n)).toBe('9,007,199,254,740,993');
  });

  it('accepts numbers for ergonomics, rounding to the nearest gp first', () => {
    expect(formatGp(1500.6)).toBe('1.5k');
    expect(formatGp(0.4)).toBe('0');
  });
});

describe('formatGpExact', () => {
  it('groups digits for tooltips and inputs', () => {
    expect(formatGpExact(1_400_000n)).toBe('1,400,000');
    expect(formatGpExact(-2_500n)).toBe('-2,500');
  });
});
