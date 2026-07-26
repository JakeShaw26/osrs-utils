import { describe, expect, it } from 'vitest';
import { MAX_LEVEL, MAX_XP, XP_AT_MAX_LEVEL, XP_TABLE } from './xp-table';

/**
 * GOLDEN-FILE TEST for the XP table.
 *
 * The table is written out as literals because that is reviewable and cheap to
 * read. This test is the reason that is safe: it recomputes all 99 entries from
 * the PUBLISHED formula and requires an exact match, so a typo in the literal
 * table cannot reach production, and neither can a mistake in the formula.
 *
 * Formula, from the OSRS Wiki "Experience" article (retrieved 2026-07-26):
 *
 *     xp(L) = floor( (1/4) * sum(n = 1 .. L-1) floor(n + 300 * 2^(n/7)) )
 *
 * Implemented from the published maths rather than copied from any project's
 * source (ADR-0007).
 */

function xpFromFormula(level: number): number {
  let sum = 0;
  for (let n = 1; n < level; n++) {
    sum += Math.floor(n + 300 * Math.pow(2, n / 7));
  }
  return Math.floor(sum / 4);
}

describe('XP_TABLE', () => {
  it('has exactly one entry per level, 1 through 99', () => {
    expect(XP_TABLE).toHaveLength(MAX_LEVEL);
  });

  it('matches the published formula at every level', () => {
    const fromFormula = Array.from({ length: MAX_LEVEL }, (_, index) =>
      xpFromFormula(index + 1),
    );

    expect([...XP_TABLE]).toEqual(fromFormula);
  });

  /**
   * Independent anchors, read off the wiki's own rendered table rather than
   * derived from the formula. If both the literals and the formula were wrong
   * in the same way, only these would catch it.
   */
  it.each([
    [1, 0],
    [2, 83],
    [50, 101_333],
    [92, 6_517_253],
    [98, 11_805_606],
    [99, 13_034_431],
  ])('level %i requires %i XP', (level, expected) => {
    expect(XP_TABLE[level - 1]).toBe(expected);
  });

  it('increases strictly — a level never costs zero XP', () => {
    for (let level = 2; level <= MAX_LEVEL; level++) {
      expect(XP_TABLE[level - 1]!).toBeGreaterThan(XP_TABLE[level - 2]!);
    }
  });

  // The distinction the calculator is asked about most often. If these ever
  // became equal, the tool would tell every 99 there is nothing left to train.
  it('separates the XP at max level from the XP ceiling', () => {
    expect(XP_AT_MAX_LEVEL).toBe(13_034_431);
    expect(MAX_XP).toBe(200_000_000);
    expect(MAX_XP).toBeGreaterThan(XP_AT_MAX_LEVEL);
  });

  it('is frozen, so a caller cannot corrupt it for every other request', () => {
    expect(Object.isFrozen(XP_TABLE)).toBe(true);
  });
});
