import { describe, expect, it } from 'vitest';
import { parseGp, parsePositiveGp, parseQuantity } from './parse-gp';

/**
 * These cases are the reason the price fields are text inputs rather than
 * `<input type="number">`. Every string below is something a player actually
 * types or pastes, and a number input yields "" for most of them — which the
 * calculator would read as 0 and display a confident, wrong margin.
 */
describe('parseGp', () => {
  it('parses plain digits', () => {
    expect(parseGp('1500')).toBe(1500);
    expect(parseGp('0')).toBe(0);
  });

  it('parses pasted thousands separators', () => {
    expect(parseGp('1,000')).toBe(1_000);
    expect(parseGp('1,478,143')).toBe(1_478_143);
    expect(parseGp('1 000 000')).toBe(1_000_000);
  });

  it('parses the k/m/b shorthand the game itself uses', () => {
    expect(parseGp('10k')).toBe(10_000);
    expect(parseGp('2.5m')).toBe(2_500_000);
    expect(parseGp('1b')).toBe(1_000_000_000);
    expect(parseGp('1.4B')).toBe(1_400_000_000);
  });

  it('ignores surrounding whitespace', () => {
    expect(parseGp('  1.5k  ')).toBe(1_500);
  });

  it('truncates fractions rather than rounding, so gp is never overstated', () => {
    expect(parseGp('1.999')).toBe(1);
    // 1.9999k = 1999.9 coins, which is 1999 whole coins.
    expect(parseGp('1.9999k')).toBe(1_999);
  });

  it('returns null for input it cannot read, rather than 0', () => {
    // This distinction matters: a calculator must be able to tell "empty" from
    // "the user typed nonsense" from "the price really is zero".
    expect(parseGp('')).toBeNull();
    expect(parseGp('   ')).toBeNull();
    expect(parseGp('abc')).toBeNull();
    expect(parseGp('1.2.3')).toBeNull();
    expect(parseGp('10kk')).toBeNull();
    expect(parseGp('1e6')).toBeNull();
    expect(parseGp('$500')).toBeNull();
    expect(parseGp(null)).toBeNull();
    expect(parseGp(undefined)).toBeNull();
  });

  it('parses negatives, leaving rejection to the caller', () => {
    expect(parseGp('-500')).toBe(-500);
  });
});

describe('parsePositiveGp', () => {
  it('rejects zero and negatives', () => {
    expect(parsePositiveGp('0')).toBeNull();
    expect(parsePositiveGp('-500')).toBeNull();
  });

  it('accepts a real price', () => {
    expect(parsePositiveGp('2.5m')).toBe(2_500_000);
  });
});

describe('parseQuantity', () => {
  it('accepts whole item counts, including shorthand', () => {
    expect(parseQuantity('1')).toBe(1);
    expect(parseQuantity('10k')).toBe(10_000);
  });

  it('rejects fractions of an item', () => {
    expect(parseQuantity('0.5')).toBeNull();
    expect(parseQuantity('0')).toBeNull();
  });
});
