import { describe, expect, it } from 'vitest';
import {
  hitChance,
  maxAttackRoll,
  monsterDefenceBonus,
  monsterDefenceRoll,
} from './accuracy';
import type { MonsterStats } from './types';

/**
 * Accuracy tests. Same golden-file rules as `max-hit.test.ts` — see the header
 * there before changing an expected value.
 *
 * Formulas: OSRS Wiki, Damage per second/{Melee,Ranged,Magic}, read 2026-07-26.
 */

/**
 * Copied verbatim from the committed Bucket row for Vorkath (Post-quest) in
 * `data/monsters.generated.ts`. Inlined rather than imported so a regeneration
 * cannot silently move an expected value — if the wiki changes Vorkath, this
 * fixture and the generated data disagree, and `loadout.test.ts` fails.
 */
const VORKATH: MonsterStats = {
  name: 'Vorkath',
  version: 'Post-quest',
  combatLevel: 732,
  hitpoints: 750,
  attack: 560,
  strength: 308,
  defence: 214,
  magic: 150,
  ranged: 308,
  stabDefence: 26,
  slashDefence: 108,
  crushDefence: 108,
  magicDefence: 240,
  rangedDefence: 26,
  size: 7,
  attributes: ['dragon', 'undead', 'fiery'],
  slayerCategories: ['Blue Dragons', 'Zombies', 'Bosses'],
};

describe('monsterDefenceRoll', () => {
  /**
   * [DERIVED] — (defence level + 9) × (style defence bonus + 64).
   * Note the +9, where the player side uses +8. Vorkath stab:
   *   (214 + 9) × (26 + 64) = 223 × 90 = 20,070
   */
  it('[DERIVED] uses +9 on the level and +64 on the bonus', () => {
    expect(monsterDefenceRoll(VORKATH, 'stab')).toBe(20_070);
  });

  /**
   * [DERIVED] — magic accuracy rolls against the monster's **Magic** level, not
   * its Defence level. Vorkath's Defence is 214 but its Magic is 150:
   *   (150 + 9) × (240 + 64) = 159 × 304 = 48,336
   * Using Defence here would give 223 × 304 = 67,792 — a 40% overstatement of
   * how hard it is to land a spell, in the wrong direction.
   */
  it('[DERIVED] rolls magic defence against the Magic level, not Defence', () => {
    expect(monsterDefenceRoll(VORKATH, 'magic')).toBe(48_336);
  });

  it('picks the right defensive stat per attack type', () => {
    expect(monsterDefenceBonus(VORKATH, 'stab')).toBe(26);
    expect(monsterDefenceBonus(VORKATH, 'slash')).toBe(108);
    expect(monsterDefenceBonus(VORKATH, 'crush')).toBe(108);
    expect(monsterDefenceBonus(VORKATH, 'ranged')).toBe(26);
    expect(monsterDefenceBonus(VORKATH, 'magic')).toBe(240);
  });

  it('handles a zero-defence monster without dividing by anything', () => {
    const dummy: MonsterStats = { ...VORKATH, defence: 0, stabDefence: 0 };

    expect(monsterDefenceRoll(dummy, 'stab')).toBe(9 * 64);
  });
});

describe('maxAttackRoll', () => {
  /**
   * [DERIVED] — effective attack × (equipment attack bonus + 64).
   * 99 Attack, Piety (×1.20 on accuracy), Accurate (+3), +137 stab:
   *   ⌊99 × 1.20⌋ = 118;  118 + 3 + 8 = 129
   *   129 × (137 + 64) = 25,929
   */
  it('[DERIVED] multiplies the effective level by the bonus plus 64', () => {
    expect(maxAttackRoll(129, 137)).toBe(25_929);
  });

  /**
   * The gear multiplier is inside the floor and applies to the whole product,
   * not to the effective level. ⌊25929 × 7/6⌋ = ⌊30250.5⌋ = 30,250.
   */
  it('[DERIVED] floors after applying the target gear multiplier', () => {
    expect(maxAttackRoll(129, 137, 7 / 6)).toBe(30_250);
  });

  it('handles a negative attack bonus without going below zero incorrectly', () => {
    // A staff on a stab attack: 129 × (−4 + 64) = 7,740. Negative bonuses
    // reduce the roll, they do not invalidate it.
    expect(maxAttackRoll(129, -4)).toBe(7_740);
  });
});

describe('hitChance', () => {
  /**
   * [DERIVED] — the two branches. Attack 25,929 vs defence 20,070:
   *   1 − (20070 + 2) / (2 × (25929 + 1)) = 1 − 20072/51860 = 0.61295796
   */
  it('[DERIVED] uses the winning branch when the attack roll is higher', () => {
    expect(hitChance(25_929, 20_070)).toBeCloseTo(0.61295796, 8);
  });

  /**
   * [DERIVED] — the losing branch: attack / (2 × (defence + 1)).
   *   10,000 / (2 × 20,071) = 0.24911564
   */
  it('[DERIVED] uses the losing branch when the defence roll is higher or equal', () => {
    expect(hitChance(10_000, 20_070)).toBeCloseTo(0.24911564, 8);
  });

  /**
   * The branches meet where the rolls are equal — ties go to the defender, so
   * an equal roll is just under 50%, and one point of attack tips it to exactly
   * 50%. A discontinuity here would mean one of the two formulas is wrong.
   */
  it('[DERIVED] is continuous across the branch boundary', () => {
    const tied = hitChance(1000, 1000);
    const oneBetter = hitChance(1001, 1000);

    expect(tied).toBeCloseTo(1000 / 2002, 10);
    expect(oneBetter).toBeCloseTo(0.5, 10);
    expect(oneBetter).toBeGreaterThan(tied);
  });

  it('never leaves the unit interval', () => {
    expect(hitChance(0, 100_000)).toBe(0);
    expect(hitChance(1_000_000, 0)).toBeLessThanOrEqual(1);
    expect(hitChance(1_000_000, 0)).toBeGreaterThan(0.999);
  });
});
