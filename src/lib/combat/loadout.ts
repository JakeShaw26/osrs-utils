import { EQUIPMENT } from './data/equipment.generated';
import type { EquipmentBonuses, EquipmentItem, EquipmentSlot } from './types';

/**
 * Turning a set of worn items into the handful of numbers the formulas want.
 *
 * Pure, and deliberately separate from the maths: gear selection is a UI
 * concern that changes often, while the formulas change on game updates only.
 */

export const EMPTY_BONUSES: EquipmentBonuses = {
  stab: 0,
  slash: 0,
  crush: 0,
  ranged: 0,
  magic: 0,
  strength: 0,
  rangedStrength: 0,
  magicDamage: 0,
  prayer: 0,
};

/** Slots the loadout UI offers, in the order the equipment interface shows them. */
export const LOADOUT_SLOTS: readonly EquipmentSlot[] = [
  'head',
  'cape',
  'neck',
  'ammo',
  'weapon',
  'body',
  'shield',
  'legs',
  'hands',
  'feet',
  'ring',
];

/**
 * Items available for a slot.
 *
 * A two-handed weapon is stored under the wiki's own `2h` slot, but a player
 * picks it from the weapon list — so `weapon` returns both, and selecting a 2h
 * weapon is what makes `shield` unavailable.
 */
export function itemsForSlot(slot: EquipmentSlot): readonly EquipmentItem[] {
  if (slot === 'weapon') {
    return EQUIPMENT.filter((item) => item.slot === 'weapon' || item.slot === '2h');
  }
  return EQUIPMENT.filter((item) => item.slot === slot);
}

export function findItem(name: string): EquipmentItem | undefined {
  return EQUIPMENT.find((item) => item.name === name);
}

export function isTwoHanded(item: EquipmentItem | undefined): boolean {
  return item?.slot === '2h';
}

/**
 * Sums the worn items.
 *
 * A shield worn with a two-handed weapon is dropped rather than added: the game
 * makes that combination impossible, and silently including it would produce a
 * loadout the user cannot actually equip but whose DPS looks great.
 */
export function sumBonuses(
  items: readonly (EquipmentItem | undefined)[],
): EquipmentBonuses {
  const worn = items.filter((item): item is EquipmentItem => item !== undefined);
  const twoHanded = worn.some(isTwoHanded);
  const effective = twoHanded ? worn.filter((item) => item.slot !== 'shield') : worn;

  return effective.reduce<EquipmentBonuses>(
    (total, item) => ({
      stab: total.stab + item.stab,
      slash: total.slash + item.slash,
      crush: total.crush + item.crush,
      ranged: total.ranged + item.ranged,
      magic: total.magic + item.magic,
      strength: total.strength + item.strength,
      rangedStrength: total.rangedStrength + item.rangedStrength,
      magicDamage: total.magicDamage + item.magicDamage,
      prayer: total.prayer + item.prayer,
    }),
    { ...EMPTY_BONUSES },
  );
}

/** The weapon's published speed in ticks, defaulting to unarmed's 4. */
export function weaponSpeedTicks(weapon: EquipmentItem | undefined): number {
  return weapon?.attackSpeed ?? 4;
}
