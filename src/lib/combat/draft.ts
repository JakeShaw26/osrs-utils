import {
  ATTACK_POTIONS,
  MAGIC_POTIONS,
  RANGED_POTIONS,
  STRENGTH_POTIONS,
  potionBoost,
  type BlackMask,
  type MagicPrayer,
  type MeleePrayer,
  type PoweredStaff,
  type RangedPrayer,
  type Salve,
  type StandardSpell,
  type VoidSet,
} from './constants';
import { DEFAULT_LEVELS, isUndead } from './defaults';
import type { CombatSetup } from './dps';
import { EMPTY_BONUSES, findItem, sumBonuses, weaponSpeedTicks } from './loadout';
import type { MagicAttackSource } from './max-hit';
import type {
  AttackStyle,
  AttackType,
  CombatClass,
  CombatLevels,
  EquipmentSlot,
  MonsterStats,
} from './types';

/**
 * The editable shape of a loadout — item *names* and potion *names*, not
 * resolved numbers.
 *
 * Kept separate from `CombatSetup` because this is what the form edits and what
 * gets written to `localStorage`, where it has to survive a data regeneration
 * and a schema change. Storing resolved bonuses instead would freeze a saved
 * loadout at whatever the item stats were on the day it was saved.
 *
 * Saved loadouts live in the member's browser and never in our database —
 * there is no sign-in, so there is nobody to own a server-side row (ADR-0012,
 * hard rule 6).
 */

export type MagicSourceKey = `spell:${StandardSpell}` | `staff:${PoweredStaff}`;

export interface LoadoutDraft {
  name: string;
  combatClass: CombatClass;
  attackType: AttackType;
  style: AttackStyle;
  void: VoidSet;
  levels: CombatLevels;
  attackPotion: keyof typeof ATTACK_POTIONS;
  strengthPotion: keyof typeof STRENGTH_POTIONS;
  rangedPotion: keyof typeof RANGED_POTIONS;
  magicPotion: keyof typeof MAGIC_POTIONS;
  meleePrayer: MeleePrayer;
  rangedPrayer: RangedPrayer;
  magicPrayer: MagicPrayer;
  /** Item names keyed by slot; an absent slot is an empty slot. */
  gear: Partial<Record<EquipmentSlot, string>>;
  magicSource: MagicSourceKey;
  extraMagicDamagePercent: number;
  blackMask: BlackMask;
  onSlayerTask: boolean;
  salve: Salve;
}

export function emptyDraft(name = 'Loadout'): LoadoutDraft {
  return {
    name,
    combatClass: 'melee',
    attackType: 'slash',
    style: 'aggressive',
    void: 'none',
    levels: { ...DEFAULT_LEVELS },
    attackPotion: 'none',
    strengthPotion: 'none',
    rangedPotion: 'none',
    magicPotion: 'none',
    meleePrayer: 'none',
    rangedPrayer: 'none',
    magicPrayer: 'none',
    gear: {},
    magicSource: 'spell:Fire surge',
    extraMagicDamagePercent: 0,
    blackMask: 'none',
    onSlayerTask: false,
    salve: 'none',
  };
}

export function parseMagicSource(key: MagicSourceKey): MagicAttackSource {
  const separator = key.indexOf(':');
  const kind = key.slice(0, separator);
  const name = key.slice(separator + 1);

  return kind === 'spell'
    ? { kind: 'spell', spell: name as StandardSpell }
    : { kind: 'powered staff', staff: name as PoweredStaff };
}

/**
 * Resolves a draft into the numbers the engine consumes.
 *
 * Two rules live here rather than in the form, because a form can be bypassed
 * and a saved loadout can be stale:
 *
 *  1. **A salve does nothing to a living target.** Leaving the user's salve
 *     selection applied against a non-undead monster is a silent 20%
 *     overstatement, and it is the sort of thing nobody notices in a
 *     comparison table.
 *  2. **A black mask does nothing off task**, which `targetMultipliers()`
 *     already enforces — repeated here only so the two cannot drift apart.
 */
export function draftToSetup(draft: LoadoutDraft, monster?: MonsterStats): CombatSetup {
  const worn = Object.values(draft.gear).map((name) => findItem(name));
  const bonuses = worn.length > 0 ? sumBonuses(worn) : { ...EMPTY_BONUSES };
  const weapon = draft.gear.weapon ? findItem(draft.gear.weapon) : undefined;

  const salveApplies = monster === undefined || isUndead(monster.attributes);

  return {
    combatClass: draft.combatClass,
    attackType: draft.attackType,
    style: draft.style,
    levels: draft.levels,
    boosts: {
      attack: potionBoost(draft.levels.attack, ATTACK_POTIONS[draft.attackPotion]),
      strength: potionBoost(
        draft.levels.strength,
        STRENGTH_POTIONS[draft.strengthPotion],
      ),
      ranged: potionBoost(draft.levels.ranged, RANGED_POTIONS[draft.rangedPotion]),
      magic: potionBoost(draft.levels.magic, MAGIC_POTIONS[draft.magicPotion]),
    },
    meleePrayer: draft.meleePrayer,
    rangedPrayer: draft.rangedPrayer,
    magicPrayer: draft.magicPrayer,
    void: draft.void,
    bonuses,
    attackSpeedTicks: weaponSpeedTicks(weapon),
    magicSource: parseMagicSource(draft.magicSource),
    extraMagicDamagePercent: draft.extraMagicDamagePercent,
    target: {
      blackMask: draft.blackMask,
      onSlayerTask: draft.onSlayerTask,
      salve: salveApplies ? draft.salve : 'none',
    },
  };
}

/** `name|version` — the only pair that identifies one fight. */
export function monsterKey(monster: MonsterStats): string {
  return `${monster.name}|${monster.version}`;
}
