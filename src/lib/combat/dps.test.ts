import { describe, expect, it } from 'vitest';
import { potionBoost, STRENGTH_POTIONS } from './constants';
import {
  averageDamagePerHit,
  calculateDps,
  compareLoadouts,
  type CombatSetup,
} from './dps';
import { EMPTY_BONUSES } from './loadout';
import type { MonsterStats } from './types';

/**
 * End-to-end DPS. Same golden-file rules as `max-hit.test.ts`.
 *
 * These cases exist to catch wiring errors that the unit tests cannot: the
 * damage side reading the accuracy style table, the accuracy side applying the
 * damage prayer, the salve multiplying the roll twice. Each asserts every
 * intermediate value, so a failure names the step that moved.
 */

/** Vorkath (Post-quest), copied from `data/monsters.generated.ts`. */
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

const superCombat = potionBoost(99, STRENGTH_POTIONS['Super combat potion']);

/** Maxed melee, Piety, super combat, stabbing with +137 attack / +118 strength. */
const MAXED_MELEE: CombatSetup = {
  combatClass: 'melee',
  attackType: 'stab',
  style: 'accurate',
  levels: { attack: 99, strength: 99, defence: 99, ranged: 99, magic: 99, hitpoints: 99 },
  boosts: { attack: superCombat, strength: superCombat, ranged: 0, magic: 0 },
  meleePrayer: 'Piety',
  rangedPrayer: 'none',
  magicPrayer: 'none',
  void: 'none',
  bonuses: { ...EMPTY_BONUSES, stab: 137, strength: 118 },
  attackSpeedTicks: 4,
  magicSource: { kind: 'spell', spell: 'Fire surge' },
  extraMagicDamagePercent: 0,
  target: { blackMask: 'none', onSlayerTask: false, salve: 'none' },
};

describe('calculateDps', () => {
  /**
   * [DERIVED] — every step written out, from Damage per second/Melee.
   *
   *   Super combat boost      ⌊99 × 0.15⌋ + 5                  = 19  → visible 118
   *   Effective strength      ⌊118 × 1.23⌋ = 145; +0 +8        = 153   (Accurate gives melee no strength)
   *   Max hit                 ⌊(153 × 182 + 320) / 640⌋        = 44
   *   Effective attack        ⌊118 × 1.20⌋ = 141; +3 +8        = 152   (Piety accuracy is 1.20, not 1.23)
   *   Attack roll             152 × (137 + 64)                 = 30,552
   *   Defence roll            (214 + 9) × (26 + 64)            = 20,070
   *   Hit chance              1 − 20,072 / (2 × 30,553)        = 0.67152162
   *   Damage per hit          44/2 + 1/45                      = 22.022222
   *   Attack interval         4 ticks × 0.6 s                  = 2.4 s
   *   DPS                     0.67152162 × 22.0222 / 2.4       = 6.16183263
   */
  it('[DERIVED] computes maxed melee DPS against Vorkath step by step', () => {
    const result = calculateDps(MAXED_MELEE, VORKATH);

    expect(result.effectiveLevel).toBe(153);
    expect(result.maxHit).toBe(44);
    expect(result.attackRoll).toBe(30_552);
    expect(result.defenceRoll).toBe(20_070);
    expect(result.accuracy).toBeCloseTo(0.67152162, 8);
    expect(result.averageDamagePerHit).toBeCloseTo(22.022222, 6);
    expect(result.attackSpeedSeconds).toBeCloseTo(2.4, 10);
    expect(result.dps).toBeCloseTo(6.16183263, 8);
    expect(result.timeToKillSeconds).toBeCloseTo(750 / result.dps, 6);
  });

  /**
   * [DERIVED] — the salve amulet (i) is 7/6 on **both** rolls against undead,
   * and Vorkath carries the `undead` attribute.
   *   Max hit      ⌊44 × 7/6⌋                        = 51
   *   Attack roll  ⌊30,552 × 7/6⌋                    = 35,644
   *   Hit chance   1 − 20,072 / (2 × 35,645)         = 0.71844578
   *   DPS          0.71844578 × (25.5 + 1/52) / 2.4  = 7.63924324
   */
  it('[DERIVED] applies the salve amulet to accuracy and damage alike', () => {
    const result = calculateDps(
      {
        ...MAXED_MELEE,
        target: { blackMask: 'none', onSlayerTask: false, salve: 'salve amulet (i)' },
      },
      VORKATH,
    );

    expect(result.maxHit).toBe(51);
    expect(result.attackRoll).toBe(35_644);
    expect(result.accuracy).toBeCloseTo(0.71844578, 8);
    expect(result.dps).toBeCloseTo(7.63924324, 8);
  });

  /** Rapid fires a tick faster; nothing else about the loadout changes. */
  it('[DERIVED] shortens the attack interval on Rapid but not on Accurate', () => {
    const ranged: CombatSetup = {
      ...MAXED_MELEE,
      combatClass: 'ranged',
      attackType: 'ranged',
      bonuses: { ...EMPTY_BONUSES, ranged: 128, rangedStrength: 80 },
      rangedPrayer: 'Rigour',
      attackSpeedTicks: 5,
    };

    expect(
      calculateDps({ ...ranged, style: 'accurate' }, VORKATH).attackSpeedSeconds,
    ).toBeCloseTo(3, 10);
    expect(
      calculateDps({ ...ranged, style: 'rapid' }, VORKATH).attackSpeedSeconds,
    ).toBeCloseTo(2.4, 10);
  });

  /**
   * A loadout that cannot hurt the target should read as "never", not as a very
   * large but finite time — the difference matters when the UI sorts on it.
   */
  it('reports an infinite time to kill when the maximum hit is zero', () => {
    const result = calculateDps(
      {
        ...MAXED_MELEE,
        combatClass: 'magic',
        attackType: 'magic',
        magicSource: { kind: 'custom', baseMaxHit: 0 },
      },
      VORKATH,
    );

    expect(result.maxHit).toBe(0);
    expect(result.dps).toBe(0);
    expect(result.timeToKillSeconds).toBe(Infinity);
  });

  /**
   * Vorkath's Magic level (150) is far below its Defence (214), which is why
   * magic lands more often here than the Defence stat suggests. This asserts
   * the magic branch reads the right one end-to-end.
   */
  it('[DERIVED] rolls magic accuracy against the Magic level end to end', () => {
    const result = calculateDps(
      {
        ...MAXED_MELEE,
        combatClass: 'magic',
        attackType: 'magic',
        magicPrayer: 'Augury',
        bonuses: { ...EMPTY_BONUSES, magic: 100, magicDamage: 20 },
        magicSource: { kind: 'spell', spell: 'Fire surge' },
        attackSpeedTicks: 5,
      },
      VORKATH,
    );

    // ⌊⌊99 × 1.25⌋ × 1 + 0 + 8⌋ = 131;  131 × (100 + 64) = 21,484
    expect(result.attackRoll).toBe(21_484);
    expect(result.defenceRoll).toBe(48_336);
    expect(result.maxHit).toBe(28); // ⌊24 × 1.20⌋
  });
});

describe('averageDamagePerHit', () => {
  /**
   * [DERIVED] — Damage per second/Melee, step eight: `maxHit/2 + 1/(maxHit+1)`.
   * The second term is there because the wiki documents a damage roll of 0 on a
   * successful attack being raised to 1.
   *
   * ⚠️ This is the one term we could not corroborate outside the wiki DPS
   * pages, and it is worth 10% at a max hit of 4 while being negligible at 40.
   * Recorded as a known uncertainty in ADR-0015.
   */
  it('[DERIVED] lifts the mean above maxHit/2 by 1/(maxHit+1)', () => {
    expect(averageDamagePerHit(4)).toBeCloseTo(2.2, 10);
    expect(averageDamagePerHit(40)).toBeCloseTo(20.02439, 6);
  });

  it('returns zero for a zero maximum hit rather than dividing by it', () => {
    expect(averageDamagePerHit(0)).toBe(0);
    expect(averageDamagePerHit(-5)).toBe(0);
  });
});

describe('compareLoadouts', () => {
  it('ranks loadouts by DPS, best first, with the best at relative 1', () => {
    const comparison = compareLoadouts(
      [
        { id: 'slow', name: 'Slow', setup: { ...MAXED_MELEE, attackSpeedTicks: 7 } },
        { id: 'fast', name: 'Fast', setup: { ...MAXED_MELEE, attackSpeedTicks: 4 } },
        { id: 'mid', name: 'Mid', setup: { ...MAXED_MELEE, attackSpeedTicks: 5 } },
      ],
      VORKATH,
    );

    expect(comparison.map((entry) => entry.id)).toEqual(['fast', 'mid', 'slow']);
    expect(comparison[0]?.relative).toBe(1);
    expect(comparison[2]?.relative).toBeLessThan(1);
    expect(comparison[2]?.relative).toBeCloseTo(4 / 7, 6);
  });

  it('returns an empty comparison for no loadouts rather than throwing', () => {
    expect(compareLoadouts([], VORKATH)).toEqual([]);
  });

  it('does not divide by zero when every loadout deals no damage', () => {
    const useless: CombatSetup = {
      ...MAXED_MELEE,
      combatClass: 'magic',
      attackType: 'magic',
      magicSource: { kind: 'custom', baseMaxHit: 0 },
    };
    const comparison = compareLoadouts([{ id: 'a', name: 'A', setup: useless }], VORKATH);

    expect(comparison[0]?.relative).toBe(0);
  });
});
