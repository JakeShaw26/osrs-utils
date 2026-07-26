import {
  MAX_LEVEL,
  MIN_LEVEL,
  SKILL_MINIMUM,
  SKILLS,
  type PlayerLevels,
  type SkillName,
} from './types';

/**
 * Level parsing and the two derived figures quests and diaries are gated on.
 *
 * Pure and separate from any component: a user pasting "1,000" or "99abc" into
 * a level box is the most common input a calculator sees, and getting NaN onto
 * the screen is the most common way one breaks. That behaviour is worth a unit
 * test, which means it cannot live inside an input handler.
 */

export type LevelParse =
  | { readonly ok: true; readonly level: number }
  | { readonly ok: false; readonly reason: string };

/** The level a skill is at before any training. */
export function minimumFor(skill: SkillName): number {
  return SKILL_MINIMUM[skill] ?? MIN_LEVEL;
}

/**
 * Parses one level field.
 *
 * Rejects rather than clamps. Clamping 100 to 99 silently answers a different
 * question than the one asked, and the member never learns their input was
 * wrong — which matters when the output is "you cannot do this quest".
 *
 * An empty string is *not* an error: it is how a member leaves a skill they do
 * not care about, and callers treat an absent level as the skill's minimum.
 */
export function parseLevel(input: string, skill?: SkillName): LevelParse {
  const trimmed = input.trim();
  if (trimmed === '') return { ok: false, reason: 'empty' };

  // Deliberately strict: Number() accepts "0x10", " 12 ", "1e2" and "".
  if (!/^\d{1,3}$/.test(trimmed)) {
    return { ok: false, reason: 'Enter a whole number between 1 and 99.' };
  }

  const level = Number(trimmed);
  const floor = skill ? minimumFor(skill) : MIN_LEVEL;

  if (level < floor) {
    return {
      ok: false,
      reason:
        floor === MIN_LEVEL
          ? `Levels start at ${MIN_LEVEL}.`
          : `${skill} starts at ${floor}.`,
    };
  }
  if (level > MAX_LEVEL)
    return { ok: false, reason: `The maximum level is ${MAX_LEVEL}.` };

  return { ok: true, level };
}

/** A level we hold for `skill`, or its untrained minimum. */
export function levelFor(levels: PlayerLevels, skill: SkillName): number {
  return levels[skill] ?? minimumFor(skill);
}

/** Sum of all 24 skills, counting untrained skills at their minimum. */
export function totalLevel(levels: PlayerLevels): number {
  return SKILLS.reduce((sum, skill) => sum + levelFor(levels, skill), 0);
}

/**
 * Combat level, from Jagex's published formula.
 *
 * Implemented from the formula rather than copied from any implementation
 * (hard rule #9 / ADR-0007). The three styles are computed separately and the
 * highest wins, which is why a pure-Ranged account is not penalised for having
 * no Strength.
 */
export function combatLevel(levels: PlayerLevels): number {
  const attack = levelFor(levels, 'attack');
  const strength = levelFor(levels, 'strength');
  const defence = levelFor(levels, 'defence');
  const hitpoints = levelFor(levels, 'hitpoints');
  const prayer = levelFor(levels, 'prayer');
  const ranged = levelFor(levels, 'ranged');
  const magic = levelFor(levels, 'magic');

  const base = (defence + hitpoints + Math.floor(prayer / 2)) / 4;

  const melee = (13 / 40) * (attack + strength);
  const range = (13 / 40) * Math.floor((3 * ranged) / 2);
  const mage = (13 / 40) * Math.floor((3 * magic) / 2);

  return Math.floor(base + Math.max(melee, range, mage));
}
