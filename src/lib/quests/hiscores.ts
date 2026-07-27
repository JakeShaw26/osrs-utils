import 'server-only';
import { OsrsApiError, osrsFetch } from '@/lib/api/osrs-fetch';
import { isSkillName, MAX_LEVEL, type PlayerLevels } from './types';

/**
 * Optional convenience: pull a member's levels from the Jagex hiscores so they
 * do not have to type 24 numbers.
 *
 * THREE THINGS THAT ARE NOT OPTIONAL ABOUT THIS
 *
 *  1. **It must be server-side.** The hiscores send no `Access-Control-Allow-
 *     Origin` header (verified — docs/api-notes/jagex-hiscores.md), so a
 *     browser physically cannot call them. `server-only` makes a mistaken
 *     client import a build error.
 *  2. **It is an open proxy unless defended.** With no auth, anyone can point
 *     a script at our route and make *us* hammer Jagex from our IP until we
 *     are blocked. The route calling this must `enforceRateLimit()`, and the
 *     5-minute per-RSN cache below is the more important half — it decouples
 *     our outbound rate from our inbound traffic (PRD §5.3).
 *  3. **Levels are all we take.** The hiscores carry no quests, no diaries and
 *     no combat achievements, so there is nothing here that could stand in for
 *     completion, however convenient that would be.
 */

interface HiscoreSkill {
  id: number;
  name: string;
  rank: number;
  level: number;
  xp: number;
}

interface HiscoreResponse {
  name?: string;
  skills?: HiscoreSkill[];
}

export type HiscoreLookup =
  | { readonly found: true; readonly name: string; readonly levels: PlayerLevels }
  /** A player who has never appeared on the hiscores. A normal state. */
  | { readonly found: false };

/** RSNs are 1–12 characters: letters, digits, spaces, hyphens and underscores. */
const RSN_PATTERN = /^[A-Za-z0-9 _-]{1,12}$/;

export function isValidRsn(rsn: string): boolean {
  return RSN_PATTERN.test(rsn);
}

/**
 * Looks up one player's levels.
 *
 * Returns `{ found: false }` for an unranked player rather than throwing.
 * Jagex answers an unknown name with a 404, which is not an error condition —
 * it is the answer, and surfacing it as a failure would put a red error box in
 * front of every member of a fresh account.
 */
export async function fetchPlayerLevels(rsn: string): Promise<HiscoreLookup> {
  if (!isValidRsn(rsn)) return { found: false };

  let body: HiscoreResponse;
  try {
    body = await osrsFetch<HiscoreResponse>('hiscores', '/index_lite.json', {
      searchParams: { player: rsn },
    });
  } catch (error) {
    if (error instanceof OsrsApiError && error.status === 404) return { found: false };
    throw error;
  }

  const levels: PlayerLevels = {};
  for (const skill of body.skills ?? []) {
    const key = skill.name.toLowerCase();
    if (!isSkillName(key)) continue; // "Overall" and any skill we do not model
    // An unranked skill comes back as -1; treat it as untrained, not as a level.
    if (!Number.isInteger(skill.level) || skill.level < 1 || skill.level > MAX_LEVEL) {
      continue;
    }
    levels[key] = skill.level;
  }

  if (Object.keys(levels).length === 0) return { found: false };

  return { found: true, name: body.name ?? rsn, levels };
}
