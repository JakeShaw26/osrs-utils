import { describe, expect, it } from 'vitest';
import { parseCountInput, parseGpInput, parseRateInput } from './parse';

describe('parseGpInput', () => {
  it('accepts a plain number', () => {
    expect(parseGpInput('1000')).toBe(1000);
  });

  // Pasted straight out of the Grand Exchange, which prints separators.
  it('accepts thousands separators', () => {
    expect(parseGpInput('1,234,567')).toBe(1_234_567);
  });

  it('accepts the k/m/b notation the game itself uses', () => {
    expect(parseGpInput('1k')).toBe(1_000);
    expect(parseGpInput('1.5m')).toBe(1_500_000);
    expect(parseGpInput('2B')).toBe(2_000_000_000);
  });

  it('ignores surrounding whitespace', () => {
    expect(parseGpInput('  42  ')).toBe(42);
  });

  // Truncating, never rounding up. Money is not rounded in the app's favour —
  // the same rule formatGp follows.
  it('truncates towards zero rather than rounding up', () => {
    expect(parseGpInput('1.55k')).toBe(1_550);
    expect(parseGpInput('1.9999k')).toBe(1_999);
  });

  it('returns null rather than NaN for unusable input', () => {
    // NaN propagates silently through arithmetic and surfaces as "NaN gp"
    // three components away. null forces a decision where the user can fix it.
    expect(parseGpInput('')).toBeNull();
    expect(parseGpInput('   ')).toBeNull();
    expect(parseGpInput('abc')).toBeNull();
    expect(parseGpInput('1m2')).toBeNull();
    expect(parseGpInput('-5')).toBeNull();
  });

  it('rejects the numeric literals Number() would silently accept', () => {
    expect(parseGpInput('0x10')).toBeNull();
    expect(parseGpInput('1e5')).toBeNull();
    expect(parseGpInput('Infinity')).toBeNull();
  });

  it('accepts zero', () => {
    expect(parseGpInput('0')).toBe(0);
  });
});

describe('parseCountInput', () => {
  it('requires at least one', () => {
    expect(parseCountInput('1')).toBe(1);
    expect(parseCountInput('0')).toBeNull();
    expect(parseCountInput('-3')).toBeNull();
  });

  it('accepts a stack written in shorthand', () => {
    expect(parseCountInput('10k')).toBe(10_000);
  });
});

describe('parseRateInput', () => {
  // parseGpInput would floor this to 2 and overstate the rate by 25%.
  it('preserves decimals', () => {
    expect(parseRateInput('2.5')).toBe(2.5);
  });

  it('rejects zero and below, which would divide by nothing', () => {
    expect(parseRateInput('0')).toBeNull();
    expect(parseRateInput('-1')).toBeNull();
    expect(parseRateInput('')).toBeNull();
  });
});
