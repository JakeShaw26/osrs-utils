import type { CombatSetup } from './dps';
import { EMPTY_BONUSES } from './loadout';
import type { AttackStyle, AttackType, CombatClass, CombatLevels } from './types';

/**
 * Sensible starting points and the small lookup tables the forms need.
 *
 * Lives in `lib/` rather than in the components because "which attack styles
 * does a ranged weapon have" is a game fact, not a layout decision — and
 * because a component cannot be unit tested without rendering it.
 */

/** A maxed main. The most common shape of question, and an obvious thing to edit down. */
export const DEFAULT_LEVELS: CombatLevels = {
  attack: 99,
  strength: 99,
  defence: 99,
  ranged: 99,
  magic: 99,
  hitpoints: 99,
};

/**
 * A non-empty list. Typed as a tuple so `[0]` is a value rather than
 * `T | undefined` — every caller uses the first entry as a default, and
 * `noUncheckedIndexedAccess` would otherwise force a meaningless null check.
 */
type NonEmpty<T> = readonly [T, ...T[]];

/** Which defence stat each class can roll against. */
export function attackTypesForClass(combatClass: CombatClass): NonEmpty<AttackType> {
  switch (combatClass) {
    case 'melee':
      return ['stab', 'slash', 'crush'];
    case 'ranged':
      return ['ranged'];
    case 'magic':
      return ['magic'];
  }
}

/**
 * Styles offered per class.
 *
 * Melee has no Rapid and ranged has no Aggressive, and offering one anyway
 * silently applies a zero bonus rather than erroring — which is exactly the
 * "looks right, is wrong" failure the constants file warns about.
 */
export function stylesForClass(combatClass: CombatClass): NonEmpty<AttackStyle> {
  switch (combatClass) {
    case 'melee':
      return ['accurate', 'aggressive', 'controlled', 'defensive'];
    case 'ranged':
      return ['accurate', 'rapid', 'longrange'];
    case 'magic':
      return ['accurate', 'longrange'];
  }
}

/** Void sets that make sense for a class. */
export function voidSetsForClass(combatClass: CombatClass) {
  switch (combatClass) {
    case 'melee':
      return ['none', 'melee'] as const;
    case 'ranged':
      return ['none', 'ranged', 'elite ranged'] as const;
    case 'magic':
      return ['none', 'magic'] as const;
  }
}

export function defaultSetup(combatClass: CombatClass = 'melee'): CombatSetup {
  return {
    combatClass,
    attackType: attackTypesForClass(combatClass)[0],
    style: combatClass === 'melee' ? 'aggressive' : 'rapid',
    levels: { ...DEFAULT_LEVELS },
    boosts: { attack: 0, strength: 0, ranged: 0, magic: 0 },
    meleePrayer: 'none',
    rangedPrayer: 'none',
    magicPrayer: 'none',
    void: 'none',
    bonuses: { ...EMPTY_BONUSES },
    attackSpeedTicks: 4,
    magicSource: { kind: 'spell', spell: 'Fire surge' },
    extraMagicDamagePercent: 0,
    target: { blackMask: 'none', onSlayerTask: false, salve: 'none' },
  };
}

/** The salve amulet only does anything against undead. */
export function isUndead(attributes: readonly string[]): boolean {
  return attributes.includes('undead');
}
