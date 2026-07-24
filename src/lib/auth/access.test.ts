import { describe, it, expect } from 'vitest';
import { decideAccess, CACHE_MAX_AGE_MS, type RoleCheck } from './access';

/**
 * Fail-closed access tests.
 *
 * These cover the vulnerability the PRD review flagged as Critical (§10/C1):
 * an implementation that falls back to cached roles when the Discord check
 * fails lets a demoted or kicked officer keep access indefinitely, and turns
 * any Discord outage into a privilege-escalation window.
 *
 * The invariant every test below defends:
 *   degrading to a LOWER tier on error is fine; degrading to a HIGHER one is not.
 */

const NOW = new Date('2026-07-24T12:00:00Z');
const fresh = (msAgo: number) => new Date(NOW.getTime() - msAgo);

const UNAVAILABLE: RoleCheck = { status: 'unavailable', reason: 'discord 503' };

describe('decideAccess — Discord answered', () => {
  it('allows when the fresh tier meets the requirement', () => {
    const d = decideAccess({
      required: 'member',
      check: { status: 'ok', tier: 'officer' },
      privileged: false,
      now: NOW,
    });
    expect(d).toEqual({ allow: true, tier: 'officer', source: 'fresh' });
  });

  it('denies when the fresh tier is too low', () => {
    const d = decideAccess({
      required: 'officer',
      check: { status: 'ok', tier: 'member' },
      privileged: false,
      now: NOW,
    });
    expect(d.allow).toBe(false);
  });

  it('trusts a DEMOTION even when the cache says otherwise', () => {
    // The demotion case. Discord is authoritative; a stale "officer" cache
    // must not override a fresh "member" answer.
    const d = decideAccess({
      required: 'officer',
      check: { status: 'ok', tier: 'member' },
      cached: { tier: 'officer', checkedAt: fresh(1000) },
      privileged: true,
      now: NOW,
    });
    expect(d).toMatchObject({ allow: false, reason: 'insufficient_tier' });
  });
});

describe('decideAccess — user kicked from the guild', () => {
  const kicked = (privileged: boolean) =>
    decideAccess({
      required: 'member',
      check: { status: 'not_member' },
      cached: { tier: 'admin', checkedAt: fresh(1000) },
      privileged,
      now: NOW,
    });

  it('denies and revokes the session, ignoring a fresh admin cache', () => {
    expect(kicked(false)).toEqual({
      allow: false,
      reason: 'not_guild_member',
      revokeSession: true,
    });
  });

  it('denies for privileged requests too', () => {
    expect(kicked(true).allow).toBe(false);
  });

  it('revokes rather than merely denying', () => {
    // Denying alone would leave them browsing on a valid cookie until expiry.
    expect(kicked(false)).toHaveProperty('revokeSession', true);
  });
});

describe('decideAccess — revalidation failed (the fail-closed branch)', () => {
  it('DENIES privileged requests even with a perfectly fresh cache', () => {
    // ⚠️ The single most important test in this file. The naive implementation
    // returns allow:true here, and that is the vulnerability.
    const d = decideAccess({
      required: 'officer',
      check: UNAVAILABLE,
      cached: { tier: 'admin', checkedAt: fresh(1000) },
      privileged: true,
      now: NOW,
    });
    expect(d).toMatchObject({ allow: false, reason: 'revalidation_failed' });
  });

  it('allows a read-only view on a recent cache', () => {
    // A brief Discord outage shouldn't log the whole clan out of a leaderboard.
    const d = decideAccess({
      required: 'member',
      check: UNAVAILABLE,
      cached: { tier: 'member', checkedAt: fresh(60_000) },
      privileged: false,
      now: NOW,
    });
    expect(d).toEqual({ allow: true, tier: 'member', source: 'cache' });
  });

  it('denies a read-only view once the cache expires', () => {
    const d = decideAccess({
      required: 'member',
      check: UNAVAILABLE,
      cached: { tier: 'member', checkedAt: fresh(CACHE_MAX_AGE_MS + 1000) },
      privileged: false,
      now: NOW,
    });
    expect(d).toMatchObject({ allow: false, reason: 'cache_expired' });
  });

  it('denies when there is no cache at all', () => {
    const d = decideAccess({
      required: 'member',
      check: UNAVAILABLE,
      privileged: false,
      now: NOW,
    });
    expect(d.allow).toBe(false);
  });

  it('still enforces the tier when serving from cache', () => {
    // Falling back to cache must not also skip the permission check.
    const d = decideAccess({
      required: 'officer',
      check: UNAVAILABLE,
      cached: { tier: 'member', checkedAt: fresh(1000) },
      privileged: false,
      now: NOW,
    });
    expect(d).toMatchObject({ allow: false, reason: 'insufficient_tier' });
  });

  it('treats a future-dated cache as expired rather than valid', () => {
    // Clock skew or a corrupt timestamp must not become an access grant.
    const d = decideAccess({
      required: 'member',
      check: UNAVAILABLE,
      cached: { tier: 'admin', checkedAt: new Date(NOW.getTime() + 60_000) },
      privileged: false,
      now: NOW,
    });
    expect(d).toMatchObject({ allow: false, reason: 'cache_expired' });
  });
});

describe('decideAccess — invariant', () => {
  it('never grants a tier above what the cache recorded', () => {
    // Property-style sweep: no combination of inputs may escalate.
    const tiers = ['guest', 'applicant', 'member', 'officer', 'admin'] as const;

    for (const cachedTier of tiers) {
      for (const required of tiers) {
        for (const privileged of [true, false]) {
          const d = decideAccess({
            required,
            check: UNAVAILABLE,
            cached: { tier: cachedTier, checkedAt: fresh(1000) },
            privileged,
            now: NOW,
          });
          if (d.allow) {
            expect(d.tier).toBe(cachedTier);
            expect(privileged).toBe(false);
          }
        }
      }
    }
  });
});
