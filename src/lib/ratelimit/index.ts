import 'server-only';
import { getEnv } from '@/lib/env';
import { bucketKeyFor, clientIpFrom, UNKNOWN_CLIENT } from './identity';
import { postgresRateLimitStore } from './postgres-store';
import {
  decide,
  type RateLimitDecision,
  type RateLimitRule,
  type RateLimitStore,
} from './types';

/**
 * The only rate-limiting API a route should touch.
 *
 * BACKGROUND — why this exists at all (PRD §5.3, ADR-0012)
 *
 * Removing authentication turned every route that proxies an upstream API into
 * an open proxy. A stranger can point a script at our public URL and make *us*
 * hammer Jagex or the Wiki from our IP until we are blocked — which takes down
 * the app for the whole clan and breaks the self-limiting promise in
 * docs/api-terms.md. The PRD's original fix was "hiscores lookup requires
 * login"; there is no login, so that fix is void.
 *
 * This limiter is the third line of defence, not the first. In order of value:
 *
 *   1. Scheduled pre-aggregation — fetch on a timer, never on a request.
 *   2. A cache shared by all visitors — with no per-user variation, one
 *      upstream fetch serves everyone, so inbound traffic stops driving
 *      outbound traffic. `osrsFetch` already does this.
 *   3. This — a cap on how fast one caller can force cache misses.
 *
 * Reaching for the limiter first means you have probably built something that
 * should have been pre-aggregated.
 */

export type { RateLimitDecision, RateLimitRule } from './types';

/**
 * Named budgets, so limits are chosen once and compared in one place rather
 * than sprinkled as magic numbers across routes.
 *
 * These are per-IP-per-minute and sized against what a human using the UI
 * plausibly does, not against what the upstream tolerates. WOM allows 20
 * req/min in total for the whole app, so any single visitor's share must be a
 * fraction of that — and the shared cache means a normal visitor generates
 * almost no upstream traffic anyway.
 */
export const RATE_LIMITS = {
  /** Interactive lookups a visitor triggers by typing (search, hiscores). */
  lookup: { limit: 20, windowSeconds: 60 },
  /** Cheap, cache-friendly reads (a price chart changing timestep). */
  browse: { limit: 60, windowSeconds: 60 },
  /** Anything that reaches an upstream that has warned us about volume. */
  strict: { limit: 6, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;

let store: RateLimitStore = postgresRateLimitStore;

/** Test seam. Swapping stores in production is an ADR, not a function call. */
export function setRateLimitStore(next: RateLimitStore): void {
  store = next;
}

interface EnforceOptions {
  /** Separates independent budgets, e.g. `'hiscores'`. */
  scope: string;
  rule: RateLimitRule;
  now?: Date;
}

/**
 * Counts this request against the caller's budget and returns the verdict.
 *
 * FAILS OPEN. If the store is unreachable the request is allowed, with
 * `degraded: true`. That is a deliberate trade: the limiter protects an
 * upstream from abuse, while failing closed would take the entire public app
 * offline on a database blip — turning a dependency wobble into a
 * self-inflicted outage. The cache above still bounds upstream traffic while
 * this is down. A route handling money or writes should make the opposite
 * choice; we have neither.
 */
export async function enforceRateLimit(
  request: Request,
  { scope, rule, now = new Date() }: EnforceOptions,
): Promise<RateLimitDecision> {
  const env = getEnv();

  // An unidentifiable caller shares one bucket with every other unidentifiable
  // caller. Giving them a free pass would make "strip the header" the bypass.
  const ip =
    clientIpFrom(request.headers, env.RATE_LIMIT_TRUSTED_PROXY_HOPS) ?? UNKNOWN_CLIENT;

  const key = bucketKeyFor(scope, ip, env.CRON_SECRET);

  try {
    return decide(await store.increment(key, rule, now), rule, now);
  } catch (error) {
    console.error(`[ratelimit] ${store.name} store failed; allowing request`, error);

    return {
      allowed: true,
      limit: rule.limit,
      remaining: rule.limit,
      resetAt: new Date(now.getTime() + rule.windowSeconds * 1000),
      retryAfterSeconds: rule.windowSeconds,
      degraded: true,
    };
  }
}

/**
 * Standard `RateLimit-*` headers plus `Retry-After`.
 *
 * Worth setting even though nothing in our UI reads them: they are what makes a
 * well-behaved client back off instead of retrying in a tight loop, and they
 * make the limiter debuggable with `curl -I`.
 */
export function rateLimitHeaders(decision: RateLimitDecision): Record<string, string> {
  const headers: Record<string, string> = {
    'RateLimit-Limit': String(decision.limit),
    'RateLimit-Remaining': String(decision.remaining),
    'RateLimit-Reset': String(decision.retryAfterSeconds),
  };

  if (!decision.allowed) headers['Retry-After'] = String(decision.retryAfterSeconds);

  return headers;
}

/**
 * The 429 to return when `allowed` is false.
 *
 * The body names no internals — not the store, not the bucket key, not whether
 * other callers are also limited. A rate-limit response is a fingerprinting
 * surface, so it says only what a legitimate client needs in order to retry.
 */
export function tooManyRequests(decision: RateLimitDecision): Response {
  return Response.json(
    { error: 'Too many requests', retryAfterSeconds: decision.retryAfterSeconds },
    {
      status: 429,
      headers: { ...rateLimitHeaders(decision), 'Cache-Control': 'no-store' },
    },
  );
}
