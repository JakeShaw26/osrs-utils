import { hitChance, maxAttackRoll, monsterDefenceRoll } from './accuracy';
import {
  MAGIC_BLACK_MASK,
  MAGIC_SALVE,
  MELEE_BLACK_MASK,
  MELEE_SALVE,
  RANGED_BLACK_MASK,
  RANGED_SALVE,
  TICK_SECONDS,
  attackSpeedForStyle,
  type MagicPrayer,
  type MeleePrayer,
  type RangedPrayer,
  type VoidSet,
} from './constants';
import {
  effectiveMagicAttack,
  effectiveMeleeAttack,
  effectiveRangedAttack,
  magicMaxHit,
  meleeMaxHit,
  rangedMaxHit,
  targetMultipliers,
  type MagicAttackSource,
  type MaxHitBreakdown,
  type TargetEffects,
} from './max-hit';
import type {
  AttackStyle,
  AttackType,
  CombatClass,
  CombatLevels,
  EquipmentBonuses,
  MonsterStats,
} from './types';

/**
 * DPS = accuracy × average damage per landed hit ÷ attack interval.
 *
 * All three terms come from elsewhere in this folder; this module's only job is
 * to hold the one shape the UI passes around and to keep the class-specific
 * branching in a single `switch` rather than scattered through components.
 *
 * Source: OSRS Wiki, Damage per second/{Melee,Ranged,Magic}, read 2026-07-26.
 */

/** Everything a single loadout needs to be evaluated. One flat bag, on purpose. */
export interface CombatSetup {
  combatClass: CombatClass;
  attackType: AttackType;
  style: AttackStyle;
  levels: CombatLevels;
  /** Flat potion boosts, already resolved by `potionBoost()`. */
  boosts: { attack: number; strength: number; ranged: number; magic: number };
  meleePrayer: MeleePrayer;
  rangedPrayer: RangedPrayer;
  magicPrayer: MagicPrayer;
  void: VoidSet;
  bonuses: EquipmentBonuses;
  /** The weapon's published speed, before the Rapid adjustment. */
  attackSpeedTicks: number;
  magicSource: MagicAttackSource;
  /** Beyond what gear supplies — the manual hatch for effects we do not model. */
  extraMagicDamagePercent: number;
  target: TargetEffects;
  dharoks?: { maxHitpoints: number; currentHitpoints: number };
  extraDamageMultiplier?: number;
}

export interface DpsResult extends MaxHitBreakdown {
  attackRoll: number;
  defenceRoll: number;
  /** Probability a swing lands, 0–1. */
  accuracy: number;
  attackSpeedSeconds: number;
  /** Expected damage per landed hit. */
  averageDamagePerHit: number;
  dps: number;
  /** Expected seconds to take the monster from full health to zero. */
  timeToKillSeconds: number;
}

/** The attack bonus that matters for the chosen attack type. */
function attackBonusFor(bonuses: EquipmentBonuses, attackType: AttackType): number {
  switch (attackType) {
    case 'stab':
      return bonuses.stab;
    case 'slash':
      return bonuses.slash;
    case 'crush':
      return bonuses.crush;
    case 'ranged':
      return bonuses.ranged;
    case 'magic':
      return bonuses.magic;
  }
}

export function calculateMaxHit(setup: CombatSetup): MaxHitBreakdown {
  switch (setup.combatClass) {
    case 'melee':
      return meleeMaxHit({
        strengthLevel: setup.levels.strength,
        strengthBoost: setup.boosts.strength,
        prayer: setup.meleePrayer,
        style: setup.style,
        strengthBonus: setup.bonuses.strength,
        void: setup.void,
        target: setup.target,
        dharoks: setup.dharoks,
        extraMultiplier: setup.extraDamageMultiplier,
      });
    case 'ranged':
      return rangedMaxHit({
        rangedLevel: setup.levels.ranged,
        rangedBoost: setup.boosts.ranged,
        prayer: setup.rangedPrayer,
        style: setup.style,
        rangedStrengthBonus: setup.bonuses.rangedStrength,
        void: setup.void,
        target: setup.target,
        extraMultiplier: setup.extraDamageMultiplier,
      });
    case 'magic':
      return magicMaxHit({
        magicLevel: setup.levels.magic,
        magicBoost: setup.boosts.magic,
        source: setup.magicSource,
        magicDamagePercent: setup.bonuses.magicDamage + setup.extraMagicDamagePercent,
        target: setup.target,
        extraMultiplier: setup.extraDamageMultiplier,
      });
  }
}

function accuracyRoll(setup: CombatSetup): number {
  const bonus = attackBonusFor(setup.bonuses, setup.attackType);

  switch (setup.combatClass) {
    case 'melee': {
      const effective = effectiveMeleeAttack({
        level: setup.levels.attack,
        boost: setup.boosts.attack,
        prayer: setup.meleePrayer,
        style: setup.style,
        void: setup.void,
      });
      const gear = targetMultipliers(MELEE_BLACK_MASK, MELEE_SALVE, setup.target).attack;
      return maxAttackRoll(effective, bonus, gear);
    }
    case 'ranged': {
      const effective = effectiveRangedAttack({
        level: setup.levels.ranged,
        boost: setup.boosts.ranged,
        prayer: setup.rangedPrayer,
        style: setup.style,
        void: setup.void,
      });
      const gear = targetMultipliers(
        RANGED_BLACK_MASK,
        RANGED_SALVE,
        setup.target,
      ).attack;
      return maxAttackRoll(effective, bonus, gear);
    }
    case 'magic': {
      const effective = effectiveMagicAttack({
        level: setup.levels.magic,
        boost: setup.boosts.magic,
        prayer: setup.magicPrayer,
        style: setup.style,
        void: setup.void,
        poweredStaff: setup.magicSource.kind === 'powered staff',
      });
      const gear = targetMultipliers(MAGIC_BLACK_MASK, MAGIC_SALVE, setup.target).attack;
      return maxAttackRoll(effective, bonus, gear);
    }
  }
}

/**
 * Expected damage on a landed hit.
 *
 * Not simply `maxHit / 2`: the wiki documents that a damage roll of 0 on an
 * otherwise successful attack is raised to 1, which lifts the mean by
 * `1 / (maxHit + 1)`. Negligible at a max hit of 40, worth 10% at a max hit of
 * 4 — so it matters exactly where a low-level player would notice.
 */
export function averageDamagePerHit(maxHit: number): number {
  if (maxHit <= 0) return 0;
  return maxHit / 2 + 1 / (maxHit + 1);
}

export function calculateDps(setup: CombatSetup, monster: MonsterStats): DpsResult {
  const breakdown = calculateMaxHit(setup);
  const attackRoll = accuracyRoll(setup);
  const defenceRoll = monsterDefenceRoll(monster, setup.attackType);
  const accuracy = hitChance(attackRoll, defenceRoll);

  const ticks = attackSpeedForStyle(setup.attackSpeedTicks, setup.style);
  const attackSpeedSeconds = ticks * TICK_SECONDS;

  const perHit = averageDamagePerHit(breakdown.maxHit);
  const dps = (accuracy * perHit) / attackSpeedSeconds;

  return {
    ...breakdown,
    attackRoll,
    defenceRoll,
    accuracy,
    attackSpeedSeconds,
    averageDamagePerHit: perHit,
    // Infinity rather than a fudged large number: a loadout that cannot damage
    // the target should read as "never", not as "a very long time".
    timeToKillSeconds: dps > 0 ? monster.hitpoints / dps : Infinity,
    dps,
  };
}

export interface NamedLoadout {
  id: string;
  name: string;
  setup: CombatSetup;
}

export interface LoadoutComparison {
  id: string;
  name: string;
  result: DpsResult;
  /** DPS relative to the best loadout in the comparison, 0–1. */
  relative: number;
}

/**
 * The same engine over N loadouts against one monster, best first.
 *
 * Ranking is the entire point of the feature, so it happens here rather than in
 * a component — a table that sorts its own rows is a table that can disagree
 * with the numbers it is showing.
 */
export function compareLoadouts(
  loadouts: readonly NamedLoadout[],
  monster: MonsterStats,
): LoadoutComparison[] {
  const evaluated = loadouts.map(({ id, name, setup }) => ({
    id,
    name,
    result: calculateDps(setup, monster),
  }));

  const best = Math.max(0, ...evaluated.map((entry) => entry.result.dps));

  return evaluated
    .map((entry) => ({ ...entry, relative: best > 0 ? entry.result.dps / best : 0 }))
    .sort((a, b) => b.result.dps - a.result.dps);
}
