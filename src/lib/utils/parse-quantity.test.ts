import { describe, expect, it } from 'vitest';
import { formatCount, parseCount, parseQuantity } from './parse-quantity';

/**
 * These are not hypothetical inputs. Players type OSRS shorthand because the
 * game itself uses it, and they paste comma-separated totals straight out of
 * the wiki. A `Number()` call reads every one of them as 0 or NaN.
 */

// Built from char codes rather than typed. A literal non-breaking space in a
// fixture is invisible in a diff, so a reviewer cannot tell this test from one
// using ordinary spaces — which would assert something completely different.
const NBSP = String.fromCharCode(0x00a0);
const NARROW_NBSP = String.fromCharCode(0x202f);

describe('parseQuantity', () => {
  it('reads plain numbers', () => {
    expect(parseQuantity('99')).toBe(99);
    expect(parseQuantity('0')).toBe(0);
    expect(parseQuantity('13034431')).toBe(13_034_431);
  });

  it('reads thousands separators, which type="number" would discard', () => {
    expect(parseQuantity('1,000')).toBe(1000);
    expect(parseQuantity('13,034,431')).toBe(13_034_431);
  });

  it('reads OSRS k/m/b shorthand', () => {
    expect(parseQuantity('1k')).toBe(1000);
    expect(parseQuantity('1.5m')).toBe(1_500_000);
    expect(parseQuantity('13m')).toBe(13_000_000);
    expect(parseQuantity('2b')).toBe(2_000_000_000);
  });

  it('is case-insensitive and tolerates surrounding whitespace', () => {
    expect(parseQuantity(' 1K ')).toBe(1000);
    expect(parseQuantity('1.5M')).toBe(1_500_000);
  });

  it('reads the invisible spaces that pasting from a rendered table produces', () => {
    expect(parseQuantity(`13${NBSP}034${NBSP}431`)).toBe(13_034_431);
    expect(parseQuantity(`13${NARROW_NBSP}034${NARROW_NBSP}431`)).toBe(13_034_431);
  });

  /**
   * The important half. `parseFloat('12abc')` is 12, which is how a typo
   * becomes a plausible wrong answer instead of a visible error.
   */
  it('rejects anything it cannot read in full, rather than salvaging a prefix', () => {
    expect(parseQuantity('12abc')).toBeNull();
    expect(parseQuantity('1k5')).toBeNull();
    expect(parseQuantity('1.2.3')).toBeNull();
    expect(parseQuantity('abc')).toBeNull();
    expect(parseQuantity('')).toBeNull();
    expect(parseQuantity('   ')).toBeNull();
    expect(parseQuantity(null)).toBeNull();
    expect(parseQuantity(undefined)).toBeNull();
  });

  it('parses negatives so a caller can say "that is negative", not "that is nonsense"', () => {
    expect(parseQuantity('-5')).toBe(-5);
    expect(parseQuantity('-1.5m')).toBe(-1_500_000);
  });

  it('passes through finite numbers and rejects non-finite ones', () => {
    expect(parseQuantity(42)).toBe(42);
    expect(parseQuantity(Number.NaN)).toBeNull();
    expect(parseQuantity(Number.POSITIVE_INFINITY)).toBeNull();
  });

  /**
   * Pins the two behaviours that differed between the two parsers this module
   * replaced, so the merge is asserted rather than assumed.
   *
   * Economy's accepted a leading dot and stripped underscores; Skilling's did
   * neither. Taking the union is safe in that direction — every input either
   * feature already accepted still parses to the same number — whereas taking
   * the intersection would have silently started rejecting input that worked.
   */
  it('accepts the leading-dot and underscore forms the Economy parser allowed', () => {
    expect(parseQuantity('.5')).toBe(0.5);
    expect(parseQuantity('-.5')).toBe(-0.5);
    expect(parseQuantity('1_000_000')).toBe(1_000_000);
  });
});

describe('parseCount', () => {
  it('truncates fractions — the game has no fractional XP totals', () => {
    expect(parseCount('99.9')).toBe(99);
    expect(parseCount('1.5k')).toBe(1500);
  });

  it('rejects negatives, which no count can be', () => {
    expect(parseCount('-5')).toBeNull();
  });

  // Zero is a legitimate starting XP, and must not be confused with "blank".
  it('accepts zero', () => {
    expect(parseCount('0')).toBe(0);
  });
});

describe('formatCount', () => {
  it('renders with thousands separators', () => {
    expect(formatCount(13_034_431)).toBe('13,034,431');
    expect(formatCount(0)).toBe('0');
  });
});
