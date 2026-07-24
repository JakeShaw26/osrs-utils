import { meetsTier, type ClanTier } from './tiers';

/**
 * Fail-closed access decisions.
 *
 * This file exists because of the single most serious finding in the PRD
 * review (§10/C1). Role revalidation against Discord can fail — expired token,
 * Discord outage, revoked authorisation, or the user having been kicked. The
 * intuitive handling is "the check failed, so keep the cached role and carry
 * on", which **silently defeats the entire point of revalidating**: a demoted
 * or kicked officer would keep access indefinitely, and an outage would become
 * a privilege-escalation window.
 *
 * The rule, stated once so every route inherits it:
 *
 *   Degrading to a LOWER tier on error is fine. Degrading to a HIGHER one never is.
 *
 * Pure function, no I/O, so every branch below is unit tested. (PRD §5.2)
 */

/** Outcome of asking Discord for the user's current roles. */
export type RoleCheck =
  /** Discord answered; these are the current roles. */
  | { status: 'ok'; tier: ClanTier }
  /** 404 / 403 — the user is no longer in the guild. Authoritative. */
  | { status: 'not_member' }
  /** Network error, 5xx, expired token. We simply do not know. */
  | { status: 'unavailable'; reason: string };

export interface AccessRequest {
  required: ClanTier;
  check: RoleCheck;
  /**
   * Last known good tier and when it was read. Used ONLY to keep read-only
   * views working through a brief outage — never to authorise a mutation.
   */
  cached?: { tier: ClanTier; checkedAt: Date };
  /**
   * True for any mutation, or any read of officer-gated data. Privileged
   * requests never fall back to cache.
   */
  privileged: boolean;
  now?: Date;
}

export type AccessDecision =
  | { allow: true; tier: ClanTier; source: 'fresh' | 'cache' }
  | { allow: false; reason: AccessDenialReason; revokeSession: boolean };

export type AccessDenialReason =
  'insufficient_tier' | 'not_guild_member' | 'revalidation_failed' | 'cache_expired';

/**
 * How long a cached tier may authorise a read-only view during an outage.
 * Short by design: this is the window in which a demoted member keeps access.
 */
export const CACHE_MAX_AGE_MS = 15 * 60 * 1000;

export function decideAccess({
  required,
  check,
  cached,
  privileged,
  now = new Date(),
}: AccessRequest): AccessDecision {
  // 1. Removed from the guild. Authoritative and immediate — no cache, no
  //    grace period, regardless of privilege. Kill the session too, or they
  //    keep browsing on a stale cookie until it expires.
  if (check.status === 'not_member') {
    return { allow: false, reason: 'not_guild_member', revokeSession: true };
  }

  // 2. Discord answered. Trust it, in both directions.
  if (check.status === 'ok') {
    return meetsTier(check.tier, required)
      ? { allow: true, tier: check.tier, source: 'fresh' }
      : { allow: false, reason: 'insufficient_tier', revokeSession: false };
  }

  // 3. We do not know the user's current roles.

  // 3a. Privileged request: deny. This is the fail-closed branch, and the whole
  //     reason this module exists. An outage must never be a way in.
  if (privileged) {
    return { allow: false, reason: 'revalidation_failed', revokeSession: false };
  }

  // 3b. Read-only: a brief outage shouldn't log the whole clan out of the
  //     leaderboard. Allow a recent cached tier, bounded by CACHE_MAX_AGE_MS.
  if (!cached) {
    return { allow: false, reason: 'revalidation_failed', revokeSession: false };
  }

  const age = now.getTime() - cached.checkedAt.getTime();
  if (age > CACHE_MAX_AGE_MS || age < 0) {
    // Negative age means a clock skew or a bad timestamp. Treat anything we
    // cannot reason about as expired rather than guessing in the user's favour.
    return { allow: false, reason: 'cache_expired', revokeSession: false };
  }

  return meetsTier(cached.tier, required)
    ? { allow: true, tier: cached.tier, source: 'cache' }
    : { allow: false, reason: 'insufficient_tier', revokeSession: false };
}
