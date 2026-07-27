/**
 * The 23 trainable OSRS skills, in the order the in-game skill tab shows them.
 *
 * A constant, not a fetch: the list has not changed since Construction and
 * Hunter were added, and the hiscores return it as `skills[]` with "Overall"
 * prepended — which is a total, not a skill, so it is not here.
 */
export const SKILLS = [
  'Attack',
  'Hitpoints',
  'Mining',
  'Strength',
  'Agility',
  'Smithing',
  'Defence',
  'Herblore',
  'Fishing',
  'Ranged',
  'Thieving',
  'Cooking',
  'Prayer',
  'Crafting',
  'Firemaking',
  'Magic',
  'Fletching',
  'Woodcutting',
  'Runecraft',
  'Slayer',
  'Farming',
  'Construction',
  'Hunter',
] as const;

export type Skill = (typeof SKILLS)[number];

export const SKILL_OPTIONS = SKILLS.map((skill) => ({ value: skill, label: skill }));

/**
 * Hitpoints starts at level 10, every other skill at 1.
 *
 * Worth encoding rather than defaulting everything to 1: a level-10 Hitpoints
 * account has 1,154 XP, so an XP calculator that assumes 0 tells them they need
 * 1,154 more XP than they do.
 */
export function startingLevel(skill: string): number {
  return skill.toLowerCase() === 'hitpoints' ? 10 : 1;
}
