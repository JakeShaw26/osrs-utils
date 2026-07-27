import { describe, expect, it } from 'vitest';
import { combatLevel, levelFor, parseLevel, totalLevel } from './levels';
import { SKILLS } from './types';

/**
 * Level parsing and the derived figures.
 *
 * The parse tests are the valuable half. Members paste "1,000", "99k" and
 * "  12  " into number fields constantly, and the failure mode this guards
 * against is NaN reaching the screen — which turns every requirement check
 * into a silent false.
 */

describe('parseLevel', () => {
  it('accepts a plain level', () => {
    expect(parseLevel('42')).toEqual({ ok: true, level: 42 });
  });

  it('accepts the boundaries', () => {
    expect(parseLevel('1')).toEqual({ ok: true, level: 1 });
    expect(parseLevel('99')).toEqual({ ok: true, level: 99 });
  });

  it.each([
    ['0', 'below the minimum'],
    ['100', 'above the maximum'],
    ['-5', 'negative'],
    ['abc', 'non-numeric'],
    ['12.5', 'fractional'],
    ['1,000', 'thumb-typed thousands separator'],
    ['99k', 'shorthand'],
    ['1e2', 'exponent notation Number() would happily accept'],
    ['0x10', 'hex notation Number() would happily accept'],
    ['9999', 'far too long'],
  ])('rejects %s (%s)', (input) => {
    expect(parseLevel(input).ok).toBe(false);
  });

  // Empty is how a member skips a skill they do not care about, so it must be
  // distinguishable from a typo — callers fall back to the minimum.
  it('treats an empty field as unset rather than invalid input', () => {
    const result = parseLevel('   ');

    expect(result).toEqual({ ok: false, reason: 'empty' });
  });

  it('rejects 5 Hitpoints, because Hitpoints starts at 10', () => {
    expect(parseLevel('5', 'hitpoints').ok).toBe(false);
    expect(parseLevel('10', 'hitpoints')).toEqual({ ok: true, level: 10 });
  });

  it('gives a reason a member can act on', () => {
    const result = parseLevel('120');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/99/);
  });
});

describe('levelFor', () => {
  it('returns the entered level', () => {
    expect(levelFor({ mining: 43 }, 'mining')).toBe(43);
  });

  it('falls back to 1 for an unentered skill', () => {
    expect(levelFor({}, 'mining')).toBe(1);
  });

  it('falls back to 10 for Hitpoints', () => {
    expect(levelFor({}, 'hitpoints')).toBe(10);
  });
});

describe('totalLevel', () => {
  // 23 skills at level 1 plus Hitpoints at 10.
  it('counts a fresh account as 33', () => {
    expect(totalLevel({})).toBe(SKILLS.length - 1 + 10);
  });

  it('adds entered levels', () => {
    expect(totalLevel({ mining: 50 })).toBe(SKILLS.length - 1 + 10 + 49);
  });
});

describe('combatLevel', () => {
  // A fresh account: 1s across the board with 10 Hitpoints.
  it('puts a new account at combat level 3', () => {
    expect(combatLevel({})).toBe(3);
  });

  it('computes a maxed melee account as 126', () => {
    const maxed = {
      attack: 99,
      strength: 99,
      defence: 99,
      hitpoints: 99,
      prayer: 99,
      ranged: 99,
      magic: 99,
    };

    expect(combatLevel(maxed)).toBe(126);
  });

  // The three styles are computed separately and the highest wins, so a pure
  // Ranged account is not penalised for having no Strength.
  it('uses the Ranged branch when it beats melee', () => {
    const ranger = { hitpoints: 10, ranged: 60 };
    const melee = { hitpoints: 10, attack: 1, strength: 1 };

    expect(combatLevel(ranger)).toBeGreaterThan(combatLevel(melee));
  });

  it('ignores skills that do not contribute', () => {
    expect(combatLevel({ mining: 99, fishing: 99 })).toBe(combatLevel({}));
  });
});
