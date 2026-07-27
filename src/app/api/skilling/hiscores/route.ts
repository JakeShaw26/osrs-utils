import { enforceRateLimit, RATE_LIMITS, tooManyRequests } from '@/lib/ratelimit';
import { lookupHiscores, normaliseRsn } from '@/lib/skilling/hiscores';

/**
 * GET /api/skilling/hiscores?rsn=<name>
 *
 * Read-only proxy for the XP calculator's optional "look up my current XP"
 * prefill. There is no write path here and there is no state to mutate — this
 * endpoint reads Jagex and returns what it says (hard rule #5).
 *
 * WHY THE PROXY IS MANDATORY, NOT A CHOICE
 *
 * The hiscores send no `Access-Control-Allow-Origin` header — verified, not
 * assumed (docs/api-notes/jagex-hiscores.md). A browser physically cannot call
 * them. This route is the only way the feature can exist at all.
 *
 * DEFENCE ORDER (PRD §5.3, ADR-0013)
 *
 *  1. `osrsFetch` caches 5 minutes per RSN — the shared cache.
 *  2. `normaliseRsn` bounds the key space so junk names cannot force a cache
 *     miss per request.
 *  3. `enforceRateLimit` caps how fast one IP can get through 1 and 2.
 *
 * The limiter fails open by design. If the counter store is unreachable the
 * request is allowed with `degraded: true`, because a database blip should not
 * take the public app offline — the cache above still bounds outbound traffic.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const decision = await enforceRateLimit(request, {
    scope: 'skilling-hiscores',
    rule: RATE_LIMITS.lookup,
  });

  if (!decision.allowed) return tooManyRequests(decision);
  if (decision.degraded) {
    console.warn('[skilling/hiscores] rate limiter degraded; request allowed');
  }

  const rsn = normaliseRsn(new URL(request.url).searchParams.get('rsn'));

  // Rejected BEFORE the upstream call, so a malformed name costs nothing and
  // cannot be used to generate cache-missing traffic.
  if (rsn === null) {
    return Response.json(
      {
        status: 'invalid',
        message: 'Names are 1-12 letters, digits, spaces or hyphens.',
      },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const result = await lookupHiscores(rsn);

  if (result.status === 'unavailable') {
    // 502, not 500: the failure is upstream, and it is genuinely transient.
    return Response.json(result, {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  // Cached at the edge for every visitor — with no per-user variation there is
  // nothing to leak between callers, and a shared cache entry is the cheapest
  // rate limiting available (CLAUDE.md: caching is a security control here).
  return Response.json(result, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
  });
}
