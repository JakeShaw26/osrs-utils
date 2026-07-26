import { createHash } from 'node:crypto';

/**
 * Who is calling, and what do we file them under.
 *
 * With no accounts (ADR-0012) the only identifier available is the network
 * address, and the network address arrives inside a header the client can
 * write. Getting this wrong doesn't produce a broken limiter — it produces a
 * limiter that passes every test and is trivially bypassed, so the reasoning is
 * spelled out rather than assumed.
 */

/** Shared bucket for callers we cannot identify. See `clientIpFrom`. */
export const UNKNOWN_CLIENT = 'unknown';

/**
 * Extracts the caller's address from proxy headers.
 *
 * ⚠️ SECURITY — why not `xff.split(',')[0]` (OWASP A01, "IP spoofing")
 *
 * `X-Forwarded-For` is a list each proxy *appends* to. A client can send the
 * header itself, so everything to the LEFT of what our own infrastructure added
 * is attacker-supplied text. Reading the leftmost entry — the example in most
 * blog posts — means an attacker sets `X-Forwarded-For: <random>` per request
 * and gets an unlimited number of fresh buckets. The limiter still reports
 * healthy while enforcing nothing.
 *
 * Only entries appended by infrastructure we control are trustworthy, and those
 * are on the RIGHT. `trustedProxyHops` says how many appenders sit in front of
 * us, so hop 1 (a single reverse proxy — the normal serverless deployment)
 * means "take the last entry".
 *
 * Setting the hop count too HIGH is the dangerous direction: it reaches past
 * our own infrastructure into client-supplied text. Too low merely buckets a
 * proxy's own address, which over-limits rather than under-limits. When
 * unsure, keep it at 1.
 */
export function clientIpFrom(headers: Headers, trustedProxyHops = 1): string | null {
  const forwarded = headers.get('x-forwarded-for');

  if (forwarded) {
    const parts = forwarded
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);

    const hops = Math.max(1, Math.trunc(trustedProxyHops));
    const candidate = parts[parts.length - hops];
    if (candidate) return candidate;

    // Fewer entries than hops configured: the header is shorter than the
    // topology says it should be, which means it was not written by the
    // proxies we expected. Trust none of it.
    return null;
  }

  // Single-valued and overwritten (not appended to) by the proxy that sets it,
  // so there is no list to mis-index. Still only as trustworthy as that proxy.
  return headers.get('x-real-ip')?.trim() || null;
}

/**
 * Derives the storage key for a caller.
 *
 * Hashed because a raw IP is personal data and we would otherwise be keeping a
 * visitor log we never asked for. Salted because IPv4 has only 2^32 values —
 * an unsalted digest is reversible by brute force in seconds, which makes
 * hashing pure theatre.
 *
 * `scope` separates independent limits (e.g. `hiscores` vs `prices`) so that
 * exhausting one does not lock a visitor out of the other.
 */
export function bucketKeyFor(scope: string, identifier: string, salt: string): string {
  return createHash('sha256')
    .update(`${salt}:${scope}:${identifier}`)
    .digest('base64url')
    .slice(0, 32);
}
