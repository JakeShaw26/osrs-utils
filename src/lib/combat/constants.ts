import type { AttackStyle } from './types';

/**
 * Every magic number the combat engine uses, with the page it came from.
 *
 * ⚠️ Sourcing rule (ADR-0007, ADR-0015): these values are transcribed from the
 * OSRS Wiki's **documented formula pages** — game facts published as prose and
 * maths. No third-party calculator source was read or ported. Each table below
 * names the page it came from so a future reader can re-verify rather than
 * re-derive, and so a game update has an obvious place to be applied.
 *
 * Sources:
 *   [MMH]  https://oldschool.runescape.wiki/w/Maximum_melee_hit
 *   [MRH]  https://oldschool.runescape.wiki/w/Maximum_ranged_hit
 *   [MMG]  https://oldschool.runescape.wiki/w/Maximum_magic_hit
 *   [DPSm] https://oldschool.runescape.wiki/w/Damage_per_second/Melee
 *   [DPSr] https://oldschool.runescape.wiki/w/Damage_per_second/Ranged
 *   [DPSg] https://oldschool.runescape.wiki/w/Damage_per_second/Magic
 *   [TSB]  https://oldschool.runescape.wiki/w/Temporary_skill_boost/<skill>
 * All read 2026-07-26.
 */

/** A game tick is 0.6s; weapon speeds are published in ticks. */
export const TICK_SECONDS = 0.6;

/** Global damage cap, added by Jagex as an anti-exploit guardrail. [MMH] */
export const DAMAGE_CAP = 200;

/* ── Prayers ──────────────────────────────────────────────────────────────── */

/**
 * Note the attack and strength multipliers differ for the same prayer — Piety
 * is +20% attack but +23% strength. Storing them as one record rather than two
 * tables keyed by name makes the mismatch impossible to lose track of. [DPSm]
 */
export interface PrayerMultipliers {
  /** Multiplies the visible level in the accuracy roll. */
  attack: number;
  /** Multiplies the visible level in the damage roll. */
  strength: number;
}

export const MELEE_PRAYERS = {
  none: { attack: 1, strength: 1 },
  'Clarity of Thought': { attack: 1.05, strength: 1 },
  'Burst of Strength': { attack: 1, strength: 1.05 },
  'Improved Reflexes': { attack: 1.1, strength: 1 },
  'Superhuman Strength': { attack: 1, strength: 1.1 },
  'Incredible Reflexes': { attack: 1.15, strength: 1 },
  'Ultimate Strength': { attack: 1, strength: 1.15 },
  Chivalry: { attack: 1.15, strength: 1.18 },
  Piety: { attack: 1.2, strength: 1.23 },
} as const satisfies Record<string, PrayerMultipliers>;

export const RANGED_PRAYERS = {
  none: { attack: 1, strength: 1 },
  'Sharp Eye': { attack: 1.05, strength: 1.05 },
  'Hawk Eye': { attack: 1.1, strength: 1.1 },
  'Eagle Eye': { attack: 1.15, strength: 1.15 },
  Deadeye: { attack: 1.18, strength: 1.18 },
  // The one asymmetric ranged prayer: +20% accuracy, +23% damage. [MRH, DPSr]
  Rigour: { attack: 1.2, strength: 1.23 },
} as const satisfies Record<string, PrayerMultipliers>;

/**
 * Magic prayers scale the accuracy roll only.
 *
 * ⚠️ Known gap: [DPSg] documents no magic *damage* prayer bonus, so none is
 * applied here. Augury is widely reported to add magic damage in-game; we have
 * no published formula for it, and inventing one would be exactly the
 * "plausible but wrong" failure this engine is meant to avoid. Use the
 * calculator's explicit "extra magic damage %" field to model it by hand.
 */
export const MAGIC_PRAYERS = {
  none: 1,
  'Mystic Will': 1.05,
  'Mystic Lore': 1.1,
  'Mystic Might': 1.15,
  Augury: 1.25,
} as const satisfies Record<string, number>;

export type MeleePrayer = keyof typeof MELEE_PRAYERS;
export type RangedPrayer = keyof typeof RANGED_PRAYERS;
export type MagicPrayer = keyof typeof MAGIC_PRAYERS;

/* ── Void Knight equipment ────────────────────────────────────────────────── */

export type VoidSet = 'none' | 'melee' | 'ranged' | 'elite ranged' | 'magic';

/**
 * Void multiplies the *effective level* after the style bonus and the +8 are
 * added — the last step, not the first. [MMH, MRH, DPSg]
 *
 * ⚠️ Known gap: elite void magic's damage bonus is not modelled. [DPSg]
 * documents only the 1.45 accuracy multiplier for magic void.
 */
export const VOID_MULTIPLIERS: Record<VoidSet, PrayerMultipliers> = {
  none: { attack: 1, strength: 1 },
  melee: { attack: 1.1, strength: 1.1 },
  ranged: { attack: 1.1, strength: 1.1 },
  'elite ranged': { attack: 1.1, strength: 1.125 },
  magic: { attack: 1.45, strength: 1 },
};

/* ── Attack styles ────────────────────────────────────────────────────────── */

/**
 * The two tables genuinely differ, and mixing them up is the classic bug: melee
 * Accurate gives +3 *accuracy* and nothing to damage, while Aggressive gives +3
 * *damage* and nothing to accuracy. Controlled gives +1 to both. [MMH, DPSm]
 */
export const MELEE_STYLE_BONUS: Record<AttackStyle, PrayerMultipliers> = {
  accurate: { attack: 3, strength: 0 },
  aggressive: { attack: 0, strength: 3 },
  controlled: { attack: 1, strength: 1 },
  defensive: { attack: 0, strength: 0 },
  rapid: { attack: 0, strength: 0 },
  longrange: { attack: 0, strength: 0 },
};

/** Ranged Accurate gives +3 to both rolls; Rapid and Longrange give none. [MRH, DPSr] */
export const RANGED_STYLE_BONUS: Record<AttackStyle, PrayerMultipliers> = {
  accurate: { attack: 3, strength: 3 },
  rapid: { attack: 0, strength: 0 },
  longrange: { attack: 0, strength: 0 },
  aggressive: { attack: 0, strength: 0 },
  controlled: { attack: 0, strength: 0 },
  defensive: { attack: 0, strength: 0 },
};

/** Magic style bonuses apply to powered staves only. [DPSg] */
export const MAGIC_STYLE_ATTACK_BONUS: Record<AttackStyle, number> = {
  accurate: 3,
  longrange: 1,
  rapid: 0,
  aggressive: 0,
  controlled: 0,
  defensive: 0,
};

/** Rapid fires one tick faster; every other style uses the weapon's speed. [DPSr] */
export function attackSpeedForStyle(baseTicks: number, style: AttackStyle): number {
  return style === 'rapid' ? Math.max(1, baseTicks - 1) : baseTicks;
}

/* ── Target-specific multipliers ──────────────────────────────────────────── */

/**
 * The black mask family and the salve family do **not** stack; when both would
 * apply the salve takes priority. `targetMultipliers()` in `max-hit.ts` is the
 * one place that resolves this, so no caller can accidentally multiply both.
 */
export type BlackMask = 'none' | 'black mask' | 'black mask (i)';
export type Salve =
  'none' | 'salve amulet' | 'salve amulet (e)' | 'salve amulet (i)' | 'salve amulet (ei)';

const SEVEN_SIXTHS = 7 / 6;

/** [MMH, DPSm] — melee black mask and salve are both 7/6 on accuracy and damage. */
export const MELEE_BLACK_MASK: Record<BlackMask, PrayerMultipliers> = {
  none: { attack: 1, strength: 1 },
  'black mask': { attack: SEVEN_SIXTHS, strength: SEVEN_SIXTHS },
  'black mask (i)': { attack: SEVEN_SIXTHS, strength: SEVEN_SIXTHS },
};

export const MELEE_SALVE: Record<Salve, PrayerMultipliers> = {
  none: { attack: 1, strength: 1 },
  'salve amulet': { attack: SEVEN_SIXTHS, strength: SEVEN_SIXTHS },
  'salve amulet (e)': { attack: 1.2, strength: 1.2 },
  'salve amulet (i)': { attack: SEVEN_SIXTHS, strength: SEVEN_SIXTHS },
  'salve amulet (ei)': { attack: 1.2, strength: 1.2 },
};

/** [MRH] — the imbued mask drops to 1.15 for ranged, but the salve stays 7/6. */
export const RANGED_BLACK_MASK: Record<BlackMask, PrayerMultipliers> = {
  none: { attack: 1, strength: 1 },
  'black mask': { attack: 1, strength: 1 },
  'black mask (i)': { attack: 1.15, strength: 1.15 },
};

export const RANGED_SALVE: Record<Salve, PrayerMultipliers> = {
  none: { attack: 1, strength: 1 },
  'salve amulet': { attack: 1, strength: 1 },
  'salve amulet (e)': { attack: 1, strength: 1 },
  'salve amulet (i)': { attack: SEVEN_SIXTHS, strength: SEVEN_SIXTHS },
  'salve amulet (ei)': { attack: 1.2, strength: 1.2 },
};

/** [MMG, DPSg] — magic uses 1.15 / 1.20, not sevenths. */
export const MAGIC_BLACK_MASK: Record<BlackMask, PrayerMultipliers> = {
  none: { attack: 1, strength: 1 },
  'black mask': { attack: 1, strength: 1 },
  'black mask (i)': { attack: 1.15, strength: 1.15 },
};

export const MAGIC_SALVE: Record<Salve, PrayerMultipliers> = {
  none: { attack: 1, strength: 1 },
  'salve amulet': { attack: 1, strength: 1 },
  'salve amulet (e)': { attack: 1, strength: 1 },
  'salve amulet (i)': { attack: 1.15, strength: 1.15 },
  'salve amulet (ei)': { attack: 1.2, strength: 1.2 },
};

/* ── Potions ──────────────────────────────────────────────────────────────── */

/**
 * Boosts are an *addition* to the visible level, computed from the base level
 * before any multiplier. [MMH, TSB]
 *
 * Note the floor is on the percentage part only: a super strength at 99 is
 * ⌊99 × 0.15⌋ + 5 = 19, not ⌊99 × 0.15 + 5⌋.
 */
export interface PotionBoost {
  flat: number;
  percent: number;
}

export function potionBoost(baseLevel: number, boost: PotionBoost): number {
  return Math.floor(baseLevel * boost.percent) + boost.flat;
}

export const ATTACK_POTIONS = {
  none: { flat: 0, percent: 0 },
  'Attack potion': { flat: 3, percent: 0.1 },
  'Super attack': { flat: 5, percent: 0.15 },
  'Super combat potion': { flat: 5, percent: 0.15 },
  'Zamorak brew': { flat: 2, percent: 0.2 },
  'Overload (+)': { flat: 6, percent: 0.16 },
  'Smelling salts': { flat: 11, percent: 0.16 },
} as const satisfies Record<string, PotionBoost>;

export const STRENGTH_POTIONS = {
  none: { flat: 0, percent: 0 },
  'Strength potion': { flat: 3, percent: 0.1 },
  'Zamorak brew': { flat: 2, percent: 0.12 },
  'Black warlock': { flat: 4, percent: 0.15 },
  'Super strength': { flat: 5, percent: 0.15 },
  'Super combat potion': { flat: 5, percent: 0.15 },
  'Overload (+)': { flat: 6, percent: 0.16 },
  'Smelling salts': { flat: 11, percent: 0.16 },
} as const satisfies Record<string, PotionBoost>;

export const RANGED_POTIONS = {
  none: { flat: 0, percent: 0 },
  'Ranging potion': { flat: 4, percent: 0.1 },
  'Bastion potion': { flat: 4, percent: 0.1 },
  'Overload (CoX)': { flat: 5, percent: 0.13 },
  'Super ranging': { flat: 5, percent: 0.15 },
  'Overload (+)': { flat: 6, percent: 0.16 },
  'Smelling salts': { flat: 11, percent: 0.16 },
} as const satisfies Record<string, PotionBoost>;

export const MAGIC_POTIONS = {
  none: { flat: 0, percent: 0 },
  'Magic potion': { flat: 4, percent: 0 },
  'Battlemage potion': { flat: 4, percent: 0 },
  'Ancient brew': { flat: 2, percent: 0.05 },
  'Forgotten brew': { flat: 3, percent: 0.08 },
  'Imbued heart': { flat: 1, percent: 0.1 },
  'Saturated heart': { flat: 4, percent: 0.1 },
  'Overload (+)': { flat: 6, percent: 0.16 },
  'Smelling salts': { flat: 11, percent: 0.16 },
} as const satisfies Record<string, PotionBoost>;

/* ── Standard-spellbook base max hits ─────────────────────────────────────── */

/** [MMG]. Powered staves scale with Magic level instead and are not in here. */
export const SPELL_BASE_MAX_HIT = {
  'Wind strike': 2,
  'Water strike': 4,
  'Earth strike': 6,
  'Fire strike': 8,
  'Wind bolt': 9,
  'Water bolt': 10,
  'Earth bolt': 11,
  'Fire bolt': 12,
  'Wind blast': 13,
  'Water blast': 14,
  'Earth blast': 15,
  'Fire blast': 16,
  'Crumble undead': 15,
  'Wind wave': 17,
  'Water wave': 18,
  'Earth wave': 19,
  'Fire wave': 20,
  'Saradomin strike': 20,
  'Claws of Guthix': 20,
  'Flames of Zamorak': 20,
  'Wind surge': 21,
  'Water surge': 22,
  'Earth surge': 23,
  'Fire surge': 24,
} as const satisfies Record<string, number>;

export type StandardSpell = keyof typeof SPELL_BASE_MAX_HIT;

/* ── Powered staves ───────────────────────────────────────────────────────── */

/**
 * Powered staves ignore the spell table and scale with the **visible** Magic
 * level: ⌊level / divisor + offset⌋. From the wiki's own powered-staff
 * calculator template, which publishes the formulas as maths.
 *
 * ⚠️ Tumeken's shadow additionally triples the magic attack and magic damage
 * bonuses of worn equipment. That is **not** modelled — see ADR-0015.
 */
export const POWERED_STAVES = {
  "Thammaron's sceptre": { divisor: 3, offset: -8 },
  'Accursed sceptre': { divisor: 3, offset: -6 },
  'Eye of ayak': { divisor: 3, offset: -6 },
  'Trident of the seas': { divisor: 3, offset: -5 },
  'Trident of the swamp': { divisor: 3, offset: -2 },
  'Sanguinesti staff': { divisor: 3, offset: -1 },
  "Tumeken's shadow": { divisor: 3, offset: 1 },
} as const satisfies Record<string, { divisor: number; offset: number }>;

export type PoweredStaff = keyof typeof POWERED_STAVES;
