/**
 * Effective combat levels — the first step of every accuracy and damage roll.
 *
 * The order of operations here is the whole game. Applying the prayer
 * multiplier to `level + style + 8` instead of to the level alone shifts a
 * maxed melee max hit by a full point, and both orderings look equally
 * reasonable in isolation — the OSRS Wiki's own `Maximum melee hit` page and
 * its `Damage per second/Melee` page disagree with each other. We follow the
 * DPS pages, and `max-hit.test.ts` pins that choice to a published outcome:
 * the wiki states the free-to-play maximum melee hit is 31, which this ordering
 * reproduces exactly and the other does not.
 *
 * Sources: Damage per second/{Melee,Ranged,Magic}, Maximum ranged hit.
 */

export interface EffectiveLevelInput {
  /** The unboosted level as it appears on the skill tab. */
  baseLevel: number;
  /** Flat levels added by a potion. Already computed by `potionBoost()`. */
  boost: number;
  prayerMultiplier: number;
  /** +3 / +1 / 0, and it is *not* the same table for accuracy and damage. */
  styleBonus: number;
  voidMultiplier: number;
}

/**
 * Shared by melee attack, melee strength, ranged attack and ranged strength.
 *
 *   ⌊ ( ⌊(level + boost) × prayer⌋ + style + 8 ) × void ⌋
 *
 * Two flooring steps, and the prayer multiplier reaches only the boosted level.
 */
export function effectiveLevel({
  baseLevel,
  boost,
  prayerMultiplier,
  styleBonus,
  voidMultiplier,
}: EffectiveLevelInput): number {
  const prayed = Math.floor((baseLevel + boost) * prayerMultiplier);
  return Math.floor((prayed + styleBonus + 8) * voidMultiplier);
}

/**
 * Magic is the exception: void multiplies *before* the style bonus and the +8,
 * not after. (Damage per second/Magic, step "Effective magic level".)
 *
 * The style bonus applies to powered staves only — a standard-spellbook cast
 * gets no style bonus regardless of the stance shown in the interface.
 */
export function effectiveMagicLevel({
  baseLevel,
  boost,
  prayerMultiplier,
  styleBonus,
  voidMultiplier,
}: EffectiveLevelInput): number {
  const prayed = Math.floor((baseLevel + boost) * prayerMultiplier);
  return Math.floor(prayed * voidMultiplier + styleBonus + 8);
}
