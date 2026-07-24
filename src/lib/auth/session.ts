import 'server-only';
import { getToken } from 'next-auth/jwt';
import { headers, cookies } from 'next/headers';
import { getEnv } from '@/lib/env';
import { decideAccess, type AccessDecision, type RoleCheck } from './access';
import { fetchClanRoleCheck } from './discord';
import { loadRoleMapping } from './role-mapping';
import { isPrivilegedTier, type ClanTier } from './tiers';

/**
 * The single server-side authorisation entry point.
 *
 * Every protected route calls `requireTier`. Centralising it is what makes
 * "deny by default" true in practice rather than aspirational: a new route that
 * forgets to call this renders nothing sensitive, because data fetching lives
 * behind these helpers rather than beside them. (PRD §5.4, OWASP A01)
 *
 * The fail-closed decision itself lives in access.ts as a pure function, so it
 * is unit tested independently of Next, cookies, and the network.
 */

export interface AuthorisedUser {
  discordId: string;
  tier: ClanTier;
  /** 'cache' means we served a stale tier during a Discord outage. */
  source: 'fresh' | 'cache';
}

export type AuthorisationResult =
  | { ok: true; user: AuthorisedUser }
  | { ok: false; decision: Extract<AccessDecision, { allow: false }>; signedIn: boolean };

/**
 * Resolves the caller's tier and decides whether they may proceed.
 *
 * `privileged` defaults to TRUE for officer-and-above requirements. Defaulting
 * the safe way round means forgetting the flag produces a stricter check, not
 * a weaker one — the opposite default would make an omission into a
 * vulnerability.
 */
export async function requireTier(
  required: ClanTier,
  options: { privileged?: boolean } = {},
): Promise<AuthorisationResult> {
  const privileged = options.privileged ?? isPrivilegedTier(required);

  const token = await getToken({
    req: { headers: await headers(), cookies: await cookies() } as never,
    secret: getEnv().AUTH_SECRET,
    secureCookie: process.env.NODE_ENV === 'production',
  });

  if (!token?.discordId || typeof token.accessToken !== 'string') {
    return {
      ok: false,
      signedIn: false,
      decision: { allow: false, reason: 'revalidation_failed', revokeSession: false },
    };
  }

  const check: RoleCheck = await fetchClanRoleCheck({
    accessToken: token.accessToken,
    guildId: getEnv().DISCORD_GUILD_ID,
    mapping: await loadRoleMapping(),
  });

  const decision = decideAccess({
    required,
    check,
    // TODO(auth): populate from members.cached_role / roles_checked_at once
    // sign-in persists members. Until then there is no cache, so an outage
    // denies rather than serving stale roles — the safe direction to be
    // incomplete in.
    cached: undefined,
    privileged,
  });

  if (!decision.allow) {
    return { ok: false, signedIn: true, decision };
  }

  return {
    ok: true,
    user: { discordId: token.discordId, tier: decision.tier, source: decision.source },
  };
}

/** Convenience for routes that should 403/redirect rather than branch. */
export async function assertTier(
  required: ClanTier,
  options?: { privileged?: boolean },
): Promise<AuthorisedUser> {
  const result = await requireTier(required, options);
  if (!result.ok) {
    throw new AuthorisationError(result.decision.reason, result.decision.revokeSession);
  }
  return result.user;
}

export class AuthorisationError extends Error {
  constructor(
    readonly reason: string,
    readonly revokeSession: boolean,
  ) {
    super(`Authorisation denied: ${reason}`);
    this.name = 'AuthorisationError';
  }
}
