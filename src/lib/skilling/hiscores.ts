import 'server-only';
import { osrsFetch, OsrsApiError } from '@/lib/api/osrs-fetch';

/**
 * Optional "look up my current XP" prefill for the XP calculator.
 *
 * EVERY CALCULATOR IN THIS SLICE WORKS WITHOUT THIS. It is a convenience that
 * saves typing a number the player can read off their own skill tab, and it is
 * built so that its absence costs nothing.
 *
 * SECURITY — why this file is more careful than it looks (ADR-0012, PRD §5.3)
 *
 * There is no auth, so this proxy is anonymous. The PRD's original protection
 * was "require login for hiscores lookup"; there is no login, so that is void.
 * Three controls replace it, and all three matter:
 *
 *  1. **`osrsFetch` caches per RSN for 5 minutes.** One name looked up a
 *     hundred times is one upstream request.
 *  2. **`normaliseRsn` bounds the key space.** This is the control that is easy
 *     to miss: without validation, an attacker sends a different junk name on
 *     every request, misses the cache every time, and turns our server into a
 *     load generator pointed at Jagex from our IP. Validation is a
 *     rate-limiting control here, not just input hygiene.
 *  3. **The route calls `enforceRateLimit`.** Third line of defence, not first.
 *
 * Jagex publishes no rate limit and treating 429/403 as *expected* is the
 * documented stance (docs/api-notes/jagex-hiscores.md).
 */

export interface HiscoreSkill {
  id: number;
  name: string;
  rank: number;
  level: number;
  xp: number;
}

/**
 * A player not being on the hiscores is a NORMAL state, not an error.
 *
 * Anyone below level ~30 total, or freshly made, simply is not listed. Modelling
 * that as a thrown error would make the commonest outcome for a new member look
 * like a broken feature (docs/api-notes/jagex-hiscores.md).
 */
export type HiscoreResult =
  | { status: 'found'; rsn: string; skills: HiscoreSkill[] }
  | { status: 'not-found'; rsn: string }
  | { status: 'unavailable'; rsn: string };

/**
 * OSRS display names: 1–12 characters of letters, digits, space, hyphen and
 * underscore. Space and underscore are interchangeable to the game.
 */
const RSN_PATTERN = /^[A-Za-z0-9 _-]{1,12}$/;

/**
 * Validates and canonicalises a display name, or returns null.
 *
 * Lowercasing is deliberate and load-bearing: the hiscores are
 * case-insensitive, so folding case means "Zezima", "zezima" and "ZEZIMA"
 * share one cache entry instead of three. Spaces fold to underscores for the
 * same reason.
 */
export function normaliseRsn(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!RSN_PATTERN.test(trimmed)) return null;
  return trimmed.toLowerCase().replace(/ /g, '_');
}

interface HiscoreResponse {
  name?: string;
  skills?: { id: number; name: string; rank: number; level: number; xp: number }[];
}

/**
 * Unranked skills come back as `-1` for rank, level and xp.
 *
 * Passing that through would put "-1" in the XP calculator's current-XP box and
 * compute a goal from it. Level 1 / 0 xp is the truthful reading: the player
 * has that skill, they are just not ranked in it.
 */
function normaliseSkill(
  raw: NonNullable<HiscoreResponse['skills']>[number],
): HiscoreSkill {
  return {
    id: raw.id,
    name: raw.name,
    rank: raw.rank,
    level: raw.level < 1 ? 1 : raw.level,
    xp: raw.xp < 0 ? 0 : raw.xp,
  };
}

/**
 * Looks up one player's skills.
 *
 * `rsn` must already have been through `normaliseRsn` — the route does that so
 * an invalid name is rejected before any budget or upstream request is spent.
 */
export async function lookupHiscores(rsn: string): Promise<HiscoreResult> {
  try {
    const body = await osrsFetch<HiscoreResponse>('hiscores', '/index_lite.json', {
      searchParams: { player: rsn },
    });

    if (!Array.isArray(body.skills) || body.skills.length === 0) {
      return { status: 'not-found', rsn };
    }

    return { status: 'found', rsn, skills: body.skills.map(normaliseSkill) };
  } catch (error) {
    // 404 is "no such player"; 403/429 is Jagex throttling us. Only the first
    // is about the player, so only the first says "not found" — telling someone
    // their account does not exist because we got rate limited is a lie.
    if (error instanceof OsrsApiError && error.status === 404) {
      return { status: 'not-found', rsn };
    }
    console.error('[skilling] hiscores lookup failed', error);
    return { status: 'unavailable', rsn };
  }
}

/** Pulls one skill's XP out of a result. Null unless the player was found. */
export function xpForSkill(result: HiscoreResult, skillName: string): number | null {
  if (result.status !== 'found') return null;
  const match = result.skills.find(
    (skill) => skill.name.toLowerCase() === skillName.toLowerCase(),
  );
  return match?.xp ?? null;
}
