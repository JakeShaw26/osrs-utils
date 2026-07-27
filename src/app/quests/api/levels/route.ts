import { enforceRateLimit, RATE_LIMITS, tooManyRequests } from '@/lib/ratelimit';
import { fetchPlayerLevels, isValidRsn } from '@/lib/quests/hiscores';

/**
 * Optional convenience endpoint: a member's skill levels, by RSN.
 *
 * ⚠️ THIS IS THE ONE PLACE THIS FEATURE TOUCHES AN UPSTREAM ON REQUEST.
 *
 * With no authentication, every caller is anonymous, so this is an open proxy
 * to Jagex unless deliberately defended (ADR-0012, PRD §5.3). Three controls,
 * in the order that matters:
 *
 *   1. **Shared cache.** `osrsFetch` caches the hiscores response for 5
 *      minutes keyed by URL, and the URL is keyed by RSN — so a hundred people
 *      looking up the same clanmate produce one upstream request. This is the
 *      control doing most of the work; the response is cacheable at the edge
 *      too, because with no accounts there is no per-user variation.
 *   2. **Rate limiting.** Caps how fast one caller can force cache misses by
 *      cycling through RSNs. It is the third line of defence, not the first.
 *   3. **Input validation.** The RSN is rejected before it reaches an outbound
 *      URL, so a caller cannot use us to fetch an arbitrary path.
 *
 * This route is read-only and mutates nothing (hard rule #5). Manual level
 * entry remains a first-class path in the UI — this only saves typing.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const rsn = new URL(request.url).searchParams.get('rsn')?.trim() ?? '';

  if (!isValidRsn(rsn)) {
    return Response.json(
      {
        error:
          'Enter a display name of 1–12 letters, digits, spaces, hyphens or underscores.',
      },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const decision = await enforceRateLimit(request, {
    scope: 'quests-hiscores',
    rule: RATE_LIMITS.lookup,
  });
  if (!decision.allowed) return tooManyRequests(decision);

  if (decision.degraded) {
    // A dead limiter and a healthy one are indistinguishable without this.
    console.warn('[quests] rate limit store degraded; hiscores lookup allowed unchecked');
  }

  try {
    const result = await fetchPlayerLevels(rsn);

    // "Not on the hiscores" is an answer, not a failure — a fresh account is
    // simply unranked, and a 404 here would put an error box in front of it.
    return Response.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (error) {
    console.error('[quests] hiscores lookup failed', error);
    return Response.json(
      { error: 'The hiscores are not responding. Enter your levels manually.' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
