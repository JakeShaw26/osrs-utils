import {
  DAMAGE_CAP,
  MAGIC_BLACK_MASK,
  MAGIC_PRAYERS,
  MAGIC_SALVE,
  MAGIC_STYLE_ATTACK_BONUS,
  MELEE_BLACK_MASK,
  MELEE_PRAYERS,
  MELEE_SALVE,
  MELEE_STYLE_BONUS,
  POWERED_STAVES,
  RANGED_BLACK_MASK,
  RANGED_PRAYERS,
  RANGED_SALVE,
  RANGED_STYLE_BONUS,
  SPELL_BASE_MAX_HIT,
  VOID_MULTIPLIERS,
  type BlackMask,
  type MagicPrayer,
  type MeleePrayer,
  type PoweredStaff,
  type PrayerMultipliers,
  type RangedPrayer,
  type Salve,
  type StandardSpell,
  type VoidSet,
} from './constants';
import { effectiveLevel, effectiveMagicLevel } from './effective-levels';
import type { AttackStyle } from './types';

/**
 * Maximum hit for all three combat classes.
 *
 * Every formula here is transcribed from the OSRS Wiki's published combat maths
 * (see `constants.ts` for the exact pages). No third-party calculator source
 * was read or ported — ADR-0007 forbids it and ADR-0015 records how we complied.
 *
 * The returned `MaxHitBreakdown` exposes the intermediate values rather than
 * just the answer. That is deliberate: a single wrong number is impossible to
 * debug, and a user who can see "effective strength 138, base 31" can tell us
 * *where* we diverge from the reference instead of just "it's wrong".
 */

export interface MaxHitBreakdown {
  /** The effective level that fed the damage roll. */
  effectiveLevel: number;
  /** Max hit before target-specific multipliers. */
  baseMaxHit: number;
  /** After black mask / salve / other multipliers, and the global cap. */
  maxHit: number;
}

/**
 * ⌊ (effective × (strength bonus + 64) + 320) / 640 ⌋
 *
 * The `+ 320` is the wiki's `0.5 +` term written as integer arithmetic, which
 * avoids a float comparison landing on the wrong side of a boundary. It is not
 * cosmetic: without it a level-1 player with no strength bonus has a maximum
 * hit of 0 and can never deal damage.
 */
function baseHitFromStrength(effective: number, strengthBonus: number): number {
  return Math.floor((effective * (strengthBonus + 64) + 320) / 640);
}

/**
 * Applies multipliers one at a time, flooring after each.
 *
 * Flooring per step is not the same as multiplying everything then flooring
 * once — ⌊⌊31 × 7/6⌋ × 1.2⌋ is 43 while ⌊31 × 7/6 × 1.2⌋ is 43.4 → 43, and the
 * two diverge as soon as a step lands just under an integer. The wiki writes it
 * as nested floors, so we do too.
 */
function applyMultipliers(base: number, multipliers: readonly number[]): number {
  let value = base;
  for (const multiplier of multipliers) value = Math.floor(value * multiplier);
  return Math.min(value, DAMAGE_CAP);
}

/**
 * Black mask and salve do not stack: when both would apply, the salve wins.
 *
 * Resolved in one place so no caller can accidentally multiply both together,
 * which is a bug that inflates every undead-slayer-task number on the page.
 */
export function targetMultipliers(
  blackMaskTable: Record<BlackMask, PrayerMultipliers>,
  salveTable: Record<Salve, PrayerMultipliers>,
  { blackMask, salve, onSlayerTask }: TargetEffects,
): PrayerMultipliers {
  if (salve !== 'none') return salveTable[salve];
  if (onSlayerTask) return blackMaskTable[blackMask];
  return { attack: 1, strength: 1 };
}

/** Which of the wearer's target-specific effects are actually live this fight. */
export interface TargetEffects {
  blackMask: BlackMask;
  /** A mask only does anything on task. */
  onSlayerTask: boolean;
  /** Set only when the target is undead; the caller checks the attribute. */
  salve: Salve;
}

export const NO_TARGET_EFFECTS: TargetEffects = {
  blackMask: 'none',
  onSlayerTask: false,
  salve: 'none',
};

/* ── Melee ────────────────────────────────────────────────────────────────── */

export interface MeleeMaxHitInput {
  strengthLevel: number;
  strengthBoost: number;
  prayer: MeleePrayer;
  style: AttackStyle;
  strengthBonus: number;
  void: VoidSet;
  target?: TargetEffects;
  /**
   * Dharok's scales damage with missing hitpoints:
   * `1 + (max HP − current HP)/100 × max HP/100`. Passing the pair rather than a
   * multiplier keeps the formula in one place and out of the UI.
   */
  dharoks?: { maxHitpoints: number; currentHitpoints: number };
  /**
   * Escape hatch for effects the engine does not model — Berserker necklace and
   * obsidian (1.3), Inquisitor's on crush (1.025), special attacks. Documented
   * as user-supplied so a wrong number is visibly the user's, not silently ours.
   */
  extraMultiplier?: number;
}

export function dharoksMultiplier(
  maxHitpoints: number,
  currentHitpoints: number,
): number {
  const missing = Math.max(0, maxHitpoints - currentHitpoints);
  return 1 + (missing / 100) * (maxHitpoints / 100);
}

export function meleeMaxHit(input: MeleeMaxHitInput): MaxHitBreakdown {
  const effective = effectiveLevel({
    baseLevel: input.strengthLevel,
    boost: input.strengthBoost,
    prayerMultiplier: MELEE_PRAYERS[input.prayer].strength,
    styleBonus: MELEE_STYLE_BONUS[input.style].strength,
    voidMultiplier: VOID_MULTIPLIERS[input.void].strength,
  });

  const base = baseHitFromStrength(effective, input.strengthBonus);
  const target = targetMultipliers(
    MELEE_BLACK_MASK,
    MELEE_SALVE,
    input.target ?? NO_TARGET_EFFECTS,
  );

  const multipliers = [target.strength];
  if (input.dharoks) {
    multipliers.push(
      dharoksMultiplier(input.dharoks.maxHitpoints, input.dharoks.currentHitpoints),
    );
  }
  if (input.extraMultiplier !== undefined) multipliers.push(input.extraMultiplier);

  return {
    effectiveLevel: effective,
    baseMaxHit: base,
    maxHit: applyMultipliers(base, multipliers),
  };
}

/* ── Ranged ───────────────────────────────────────────────────────────────── */

export interface RangedMaxHitInput {
  rangedLevel: number;
  rangedBoost: number;
  prayer: RangedPrayer;
  style: AttackStyle;
  /** Weapon + ammunition. Ammo carries most of it on a bow. */
  rangedStrengthBonus: number;
  void: VoidSet;
  target?: TargetEffects;
  /** Bolt procs, Dark bow, Craw's bow — see the "not handled" list in ADR-0015. */
  extraMultiplier?: number;
}

export function rangedMaxHit(input: RangedMaxHitInput): MaxHitBreakdown {
  const effective = effectiveLevel({
    baseLevel: input.rangedLevel,
    boost: input.rangedBoost,
    prayerMultiplier: RANGED_PRAYERS[input.prayer].strength,
    styleBonus: RANGED_STYLE_BONUS[input.style].strength,
    voidMultiplier: VOID_MULTIPLIERS[input.void].strength,
  });

  const base = baseHitFromStrength(effective, input.rangedStrengthBonus);
  const target = targetMultipliers(
    RANGED_BLACK_MASK,
    RANGED_SALVE,
    input.target ?? NO_TARGET_EFFECTS,
  );

  const multipliers = [target.strength];
  if (input.extraMultiplier !== undefined) multipliers.push(input.extraMultiplier);

  return {
    effectiveLevel: effective,
    baseMaxHit: base,
    maxHit: applyMultipliers(base, multipliers),
  };
}

/* ── Magic ────────────────────────────────────────────────────────────────── */

/**
 * Magic damage does not come from an effective level at all — the spell or the
 * powered staff fixes the base hit and equipment adds a flat percentage.
 */
export type MagicAttackSource =
  | { kind: 'spell'; spell: StandardSpell }
  | { kind: 'powered staff'; staff: PoweredStaff }
  | { kind: 'custom'; baseMaxHit: number };

export interface MagicMaxHitInput {
  magicLevel: number;
  magicBoost: number;
  source: MagicAttackSource;
  /** Summed `magic_damage_bonus` from gear, in percentage points. */
  magicDamagePercent: number;
  target?: TargetEffects;
  extraMultiplier?: number;
}

/**
 * Powered staves scale with the **visible** (boosted) Magic level, which is why
 * the boost is added before the staff formula rather than after.
 */
export function poweredStaffMaxHit(
  staff: PoweredStaff,
  visibleMagicLevel: number,
): number {
  const { divisor, offset } = POWERED_STAVES[staff];
  return Math.max(0, Math.floor(visibleMagicLevel / divisor + offset));
}

export function magicMaxHit(input: MagicMaxHitInput): MaxHitBreakdown {
  const visibleLevel = input.magicLevel + input.magicBoost;

  const base =
    input.source.kind === 'spell'
      ? SPELL_BASE_MAX_HIT[input.source.spell]
      : input.source.kind === 'powered staff'
        ? poweredStaffMaxHit(input.source.staff, visibleLevel)
        : input.source.baseMaxHit;

  // Gear magic damage is additive among itself, then applied as one multiplier
  // — unlike melee's chain of independent multiplicative effects.
  const withDamageBonus = Math.floor(base * (1 + input.magicDamagePercent / 100));

  const target = targetMultipliers(
    MAGIC_BLACK_MASK,
    MAGIC_SALVE,
    input.target ?? NO_TARGET_EFFECTS,
  );

  const multipliers = [target.strength];
  if (input.extraMultiplier !== undefined) multipliers.push(input.extraMultiplier);

  return {
    effectiveLevel: visibleLevel,
    baseMaxHit: withDamageBonus,
    maxHit: applyMultipliers(withDamageBonus, multipliers),
  };
}

/* ── Accuracy-side effective levels ───────────────────────────────────────── */

export interface EffectiveAttackInput {
  level: number;
  boost: number;
  style: AttackStyle;
  void: VoidSet;
}

export function effectiveMeleeAttack(
  input: EffectiveAttackInput & { prayer: MeleePrayer },
): number {
  return effectiveLevel({
    baseLevel: input.level,
    boost: input.boost,
    prayerMultiplier: MELEE_PRAYERS[input.prayer].attack,
    styleBonus: MELEE_STYLE_BONUS[input.style].attack,
    voidMultiplier: VOID_MULTIPLIERS[input.void].attack,
  });
}

export function effectiveRangedAttack(
  input: EffectiveAttackInput & { prayer: RangedPrayer },
): number {
  return effectiveLevel({
    baseLevel: input.level,
    boost: input.boost,
    prayerMultiplier: RANGED_PRAYERS[input.prayer].attack,
    styleBonus: RANGED_STYLE_BONUS[input.style].attack,
    voidMultiplier: VOID_MULTIPLIERS[input.void].attack,
  });
}

export function effectiveMagicAttack(
  input: EffectiveAttackInput & { prayer: MagicPrayer; poweredStaff: boolean },
): number {
  return effectiveMagicLevel({
    baseLevel: input.level,
    boost: input.boost,
    prayerMultiplier: MAGIC_PRAYERS[input.prayer],
    styleBonus: input.poweredStaff ? MAGIC_STYLE_ATTACK_BONUS[input.style] : 0,
    voidMultiplier: VOID_MULTIPLIERS[input.void].attack,
  });
}
