import { describe, expect, it } from 'vitest';
import { EQUIPMENT } from './data/equipment.generated';
import { MONSTERS } from './data/monsters.generated';
import {
  EMPTY_BONUSES,
  findItem,
  isTwoHanded,
  itemsForSlot,
  sumBonuses,
  weaponSpeedTicks,
} from './loadout';

/**
 * Loadout assembly, plus a handful of invariants over the committed Bucket
 * data. The data tests are cheap insurance: a regeneration that quietly changes
 * a slot name or drops a weapon's attack speed would otherwise surface as a
 * calculator that renders but computes nonsense.
 */

describe('sumBonuses', () => {
  it('returns zeroes for an empty loadout rather than NaN', () => {
    expect(sumBonuses([])).toEqual(EMPTY_BONUSES);
    expect(sumBonuses([undefined, undefined])).toEqual(EMPTY_BONUSES);
  });

  it('adds every stat across the worn items', () => {
    const whip = findItem('Abyssal whip');
    const amulet = findItem('Amulet of strength');
    const total = sumBonuses([whip, amulet]);

    // Bucket rows: whip +82 slash / +82 strength, amulet +10 strength.
    expect(total.slash).toBe(82);
    expect(total.strength).toBe(92);
  });

  /**
   * A shield worn with a two-handed weapon is a loadout the game will not let
   * you equip. Including it anyway would show a DPS number nobody can achieve —
   * a comparison table's worst failure mode, because it looks entirely normal.
   */
  it('drops a shield when a two-handed weapon is equipped', () => {
    const greataxe = findItem("Dharok's greataxe");
    const defender = findItem('Avernic defender');

    expect(isTwoHanded(greataxe)).toBe(true);
    expect(sumBonuses([greataxe, defender]).strength).toBe(greataxe?.strength);
    expect(sumBonuses([greataxe, defender]).strength).not.toBe(
      (greataxe?.strength ?? 0) + (defender?.strength ?? 0),
    );
  });

  it('keeps the shield when the weapon is one-handed', () => {
    const whip = findItem('Abyssal whip');
    const defender = findItem('Avernic defender');

    expect(isTwoHanded(whip)).toBe(false);
    expect(sumBonuses([whip, defender]).strength).toBe(
      (whip?.strength ?? 0) + (defender?.strength ?? 0),
    );
  });
});

describe('itemsForSlot', () => {
  it('offers two-handed weapons in the weapon slot', () => {
    const weapons = itemsForSlot('weapon').map((item) => item.name);

    expect(weapons).toContain('Abyssal whip'); // one-handed
    expect(weapons).toContain('Twisted bow'); // two-handed, stored under `2h`
  });

  it('never offers a weapon in an armour slot', () => {
    expect(itemsForSlot('head').every((item) => item.slot === 'head')).toBe(true);
  });
});

describe('weaponSpeedTicks', () => {
  it('falls back to unarmed speed when no weapon is equipped', () => {
    expect(weaponSpeedTicks(undefined)).toBe(4);
  });

  it('reads the published speed from the Bucket row', () => {
    expect(weaponSpeedTicks(findItem('Abyssal whip'))).toBe(4);
    expect(weaponSpeedTicks(findItem('Twisted bow'))).toBe(6);
    expect(weaponSpeedTicks(findItem("Dharok's greataxe"))).toBe(7);
  });
});

describe('committed Bucket data', () => {
  it('gives every weapon an attack speed', () => {
    const speedless = EQUIPMENT.filter(
      (item) => (item.slot === 'weapon' || item.slot === '2h') && !item.attackSpeed,
    );

    expect(speedless).toEqual([]);
  });

  it('has no duplicate item names', () => {
    const names = EQUIPMENT.map((item) => item.name);

    expect(new Set(names).size).toBe(names.length);
  });

  /**
   * The degraded-variant trap: `infobox_bonuses` returns a second, all-zero row
   * for Barrows equipment. Picking the wrong one silently halves a Dharok's
   * loadout's damage.
   */
  it('kept the undamaged variant of a Barrows item', () => {
    expect(findItem("Dharok's greataxe")?.strength).toBe(105);
  });

  /**
   * Multi-form monsters must survive as separate rows — Zulrah's three forms
   * differ only in magic defence, and collapsing them would answer confidently
   * about the wrong fight.
   */
  it('keeps every distinct monster version', () => {
    const zulrah = MONSTERS.filter((monster) => monster.name === 'Zulrah');

    expect(zulrah).toHaveLength(3);
    expect(new Set(zulrah.map((form) => form.magicDefence)).size).toBeGreaterThan(1);
  });

  /**
   * Pins the fixture the accuracy and DPS golden tests inline. If a
   * regeneration moves Vorkath's stats, this fails here rather than silently
   * invalidating every expected DPS value in the suite.
   */
  it('still matches the Vorkath stats the golden tests were computed from', () => {
    const vorkath = MONSTERS.find(
      (monster) => monster.name === 'Vorkath' && monster.version === 'Post-quest',
    );

    expect(vorkath).toMatchObject({
      hitpoints: 750,
      defence: 214,
      magic: 150,
      stabDefence: 26,
      magicDefence: 240,
      rangedDefence: 26,
      attributes: ['dragon', 'undead', 'fiery'],
    });
  });

  it('exposes every monster with a positive hitpoint total', () => {
    expect(MONSTERS.every((monster) => monster.hitpoints > 0)).toBe(true);
  });
});
