/**
 * Combat Achievement shapes, split out from `combat-achievements.ts`.
 *
 * That module imports `server-only` (via the Bucket client), so a client
 * component importing a *type* from it would drag a server module into the
 * browser bundle and fail the build. Types live here instead, where both sides
 * can reach them.
 */

export interface CombatAchievement {
  /** Wiki `combat_achievement.id` — the key self-declared progress is stored by. */
  id: number;
  name: string;
  monster: string;
  task: string;
  tier: string;
  type: string;
}

/** Game order, so the UI does not have to know it. */
export const CA_TIER_ORDER = [
  'Easy',
  'Medium',
  'Hard',
  'Elite',
  'Master',
  'Grandmaster',
] as const;
