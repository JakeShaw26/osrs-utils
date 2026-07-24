import 'server-only';
import type { RoleCheck } from './access';
import { resolveTier, type RoleMapping } from './tiers';

/**
 * Reads the signed-in user's roles in the clan guild.
 *
 * Uses a USER access token against `/users/@me/guilds/{id}/member`, which per
 * ADR-0010 does not require our application to be in the guild. That claim is
 * verified by `scripts/verify-discord-oauth.mjs` (V11a) — if that script ever
 * fails, this function is the thing that breaks.
 *
 * Its whole job is turning an HTTP response into an honest `RoleCheck`. Getting
 * that mapping wrong is how the fail-closed model in access.ts gets defeated
 * from underneath, so each status is handled deliberately rather than lumped
 * into a try/catch.
 */

const DISCORD_API = 'https://discord.com/api/v10';

export interface GuildMemberLookup {
  accessToken: string;
  guildId: string;
  mapping: RoleMapping;
  signal?: AbortSignal;
}

export async function fetchClanRoleCheck({
  accessToken,
  guildId,
  mapping,
  signal,
}: GuildMemberLookup): Promise<RoleCheck> {
  let response: Response;

  try {
    response = await fetch(`${DISCORD_API}/users/@me/guilds/${guildId}/member`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal,
      cache: 'no-store', // authorisation data must never be served from a cache
    });
  } catch (error) {
    // Network failure, DNS, timeout. We do not know their roles.
    return { status: 'unavailable', reason: `network: ${(error as Error).message}` };
  }

  return interpretMemberResponse(response.status, await safeJson(response), mapping);
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Maps a status code to a RoleCheck. Exported for testing — this mapping is
 * security-critical and deserves direct coverage without mocking `fetch`.
 */
export function interpretMemberResponse(
  status: number,
  body: unknown,
  mapping: RoleMapping,
): RoleCheck {
  // 404 — Discord is telling us authoritatively that this user is not a member
  // of this guild. The only status we treat as proof of absence.
  if (status === 404) {
    return { status: 'not_member' };
  }

  // 401 — the token is bad or expired. Says nothing about membership, so we
  // must NOT revoke on it; the caller should attempt a refresh first.
  if (status === 401) {
    return { status: 'unavailable', reason: 'token rejected (401)' };
  }

  // 403 — ambiguous: missing scope, or the app lacking access. Deliberately
  // NOT treated as not_member: if it were, a scope misconfiguration would log
  // out and de-link the entire clan at once. Fail closed without destroying
  // sessions.
  if (status === 403) {
    return { status: 'unavailable', reason: 'forbidden (403) — check scopes' };
  }

  if (status === 429) {
    return { status: 'unavailable', reason: 'rate limited (429)' };
  }

  if (status >= 500) {
    return { status: 'unavailable', reason: `discord error (${status})` };
  }

  if (status !== 200) {
    return { status: 'unavailable', reason: `unexpected status ${status}` };
  }

  // 200 — but only trust it if the payload is the shape we expect. A malformed
  // body must not silently resolve to `guest` as though it were a real answer.
  const roles = extractRoles(body);
  if (!roles) {
    return { status: 'unavailable', reason: 'malformed member payload' };
  }

  return { status: 'ok', tier: resolveTier(roles, mapping) };
}

function extractRoles(body: unknown): string[] | null {
  if (typeof body !== 'object' || body === null) return null;
  const roles = (body as { roles?: unknown }).roles;
  if (!Array.isArray(roles)) return null;
  return roles.every((r) => typeof r === 'string') ? (roles as string[]) : null;
}
