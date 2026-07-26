import { describe, expect, it } from 'vitest';
import {
  DropRateError,
  chanceOfAtLeast,
  chanceOfAtLeastOne,
  chanceOfExactly,
  expectedDrops,
  killsForConfidence,
} from './drop-rate';

/**
 * Drop-rate maths. Unlike the combat formulas these are plain binomial
 * probability, so the expected values are checkable with any calculator and
 * carry no game-update risk — no golden-file ceremony needed.
 */

const SIGIL = 1 / 512; // Elysian sigil, the canonical "am I dry?" rate

describe('chanceOfAtLeastOne', () => {
  /**
   * At exactly the drop rate you are still more likely than not to have it —
   * but only just, and the answer converges to 1 − 1/e ≈ 0.6321 rather than to
   * certainty. This is the number that surprises people.
   *   1 − (511/512)^512 = 0.6324801
   */
  it('is ~63.3% at exactly the drop rate, not 100%', () => {
    expect(chanceOfAtLeastOne(SIGIL, 512)).toBeCloseTo(0.6324801, 7);
  });

  it('is zero at zero kills and rises monotonically', () => {
    expect(chanceOfAtLeastOne(SIGIL, 0)).toBe(0);
    expect(chanceOfAtLeastOne(SIGIL, 1)).toBeCloseTo(SIGIL, 12);
    expect(chanceOfAtLeastOne(SIGIL, 100)).toBeLessThan(chanceOfAtLeastOne(SIGIL, 101));
  });

  it('is certain when the drop is guaranteed and never when it is impossible', () => {
    expect(chanceOfAtLeastOne(1, 1)).toBe(1);
    expect(chanceOfAtLeastOne(0, 100_000)).toBe(0);
  });

  it('rejects a probability outside [0, 1] rather than returning a number', () => {
    expect(() => chanceOfAtLeastOne(1.5, 10)).toThrow(DropRateError);
    expect(() => chanceOfAtLeastOne(-0.1, 10)).toThrow(DropRateError);
  });

  it('rejects a fractional or negative kill count', () => {
    expect(() => chanceOfAtLeastOne(SIGIL, 10.5)).toThrow(DropRateError);
    expect(() => chanceOfAtLeastOne(SIGIL, -1)).toThrow(DropRateError);
  });
});

describe('chanceOfExactly', () => {
  it('matches a hand-checkable small case', () => {
    // Exactly one head in two coin flips: C(2,1) × 0.5 × 0.5 = 0.5
    expect(chanceOfExactly(0.5, 2, 1)).toBeCloseTo(0.5, 12);
    expect(chanceOfExactly(0.5, 2, 0)).toBeCloseTo(0.25, 12);
    expect(chanceOfExactly(0.5, 2, 2)).toBeCloseTo(0.25, 12);
  });

  it('is impossible to succeed more often than you attempt', () => {
    expect(chanceOfExactly(0.5, 2, 3)).toBe(0);
  });

  /**
   * The naive implementation multiplies C(10000, 5) — around 8 × 10^16 — by a
   * probability that has already underflowed, and returns NaN or Infinity.
   * Computing in log space is the only reason this passes.
   */
  it('survives a kill count large enough to overflow the naive formula', () => {
    const result = chanceOfExactly(SIGIL, 10_000, 5);

    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
  });

  it('sums to 1 across every possible outcome', () => {
    const total = Array.from({ length: 21 }, (_, k) =>
      chanceOfExactly(0.3, 20, k),
    ).reduce((a, b) => a + b, 0);

    expect(total).toBeCloseTo(1, 10);
  });
});

describe('chanceOfAtLeast', () => {
  it('agrees with chanceOfAtLeastOne when asked for one', () => {
    expect(chanceOfAtLeast(SIGIL, 512, 1)).toBeCloseTo(
      chanceOfAtLeastOne(SIGIL, 512),
      12,
    );
  });

  it('is certain when asked for zero successes', () => {
    expect(chanceOfAtLeast(SIGIL, 0, 0)).toBe(1);
  });

  it('is impossible when asked for more successes than kills', () => {
    expect(chanceOfAtLeast(0.5, 3, 4)).toBe(0);
  });

  it('never returns a negative probability from floating-point drift', () => {
    expect(chanceOfAtLeast(0.999, 1000, 1)).toBeGreaterThanOrEqual(0);
    expect(chanceOfAtLeast(0.999, 1000, 1)).toBeLessThanOrEqual(1);
  });
});

describe('killsForConfidence', () => {
  /**
   * ln(0.01) / ln(511/512) = 2,355.5 → 2,356 kills for a 99% chance at 1/512,
   * about 4.6× the drop rate. The practical answer to "how dry can I get".
   */
  it('needs ~4.6× the drop rate for 99% confidence', () => {
    expect(killsForConfidence(SIGIL, 0.99)).toBe(2356);
  });

  it('needs about 0.69× the drop rate for a coin flip', () => {
    expect(killsForConfidence(SIGIL, 0.5)).toBe(355);
  });

  it('is never certain — 100% confidence takes infinite kills', () => {
    expect(killsForConfidence(SIGIL, 1)).toBe(Infinity);
  });

  it('needs no kills for zero confidence and infinite kills for an impossible drop', () => {
    expect(killsForConfidence(SIGIL, 0)).toBe(0);
    expect(killsForConfidence(0, 0.5)).toBe(Infinity);
  });
});

describe('expectedDrops', () => {
  it('is simply rate × kills, and may be fractional', () => {
    expect(expectedDrops(SIGIL, 512)).toBeCloseTo(1, 12);
    expect(expectedDrops(SIGIL, 100)).toBeCloseTo(0.195313, 6);
  });
});
