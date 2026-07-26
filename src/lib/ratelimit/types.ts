/**
 * Rate limiting — the contract, kept free of any storage or framework detail.
 *
 * Hosting is deferred (ADR-0006), so no call site may name a backing store. A
 * route asks `enforceRateLimit()` for a decision; whether the counter lives in
 * Postgres, Redis or a process-local Map is chosen once, in one file, and can
 * change without touching a single route.
 *
 * See ADR-0013 for why a fixed window, and why fail-open.
 */

/** How many requests, over how long. */
export interface RateLimitRule {
  limit: number;
  windowSeconds: number;
}

/** What a store did. Deliberately *not* a verdict — see `decide()`. */
export interface CounterState {
  /** Hits recorded in this window, including the one just counted. */
  hits: number;
  /** Start of the window the hit landed in. */
  windowStart: Date;
}

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  /** Never negative — a caller 40 over the limit still sees 0. */
  remaining: number;
  /** When the window rolls and the caller gets a fresh budget. */
  resetAt: Date;
  /** Seconds until `resetAt`, for the `Retry-After` header. Always ≥ 1. */
  retryAfterSeconds: number;
  /**
   * True when the store failed and the request was let through unchecked.
   * Surface this in logs — a limiter that has silently stopped limiting looks
   * exactly like a limiter that is working.
   */
  degraded: boolean;
}

export interface RateLimitStore {
  /** Names the store in logs, so "degraded" is diagnosable. */
  readonly name: string;

  /**
   * Records one hit against `key` and returns the resulting count.
   *
   * MUST be atomic. Two serverless invocations hitting the same key at the same
   * instant must produce 1 and 2, never 1 and 1 — a read-then-write
   * implementation looks correct in every test and leaks limit under the exact
   * load the limiter exists for.
   */
  increment(key: string, rule: RateLimitRule, now: Date): Promise<CounterState>;
}

/**
 * Snaps a timestamp down to the start of its fixed window.
 *
 * Quantising the clock is what makes the window shared: every instance
 * computes the same boundary from the same wall clock, so they all increment
 * the same row without coordinating.
 */
export function windowStartFor(now: Date, windowSeconds: number): Date {
  const ms = windowSeconds * 1000;
  return new Date(Math.floor(now.getTime() / ms) * ms);
}

/**
 * Turns a counter reading into a verdict. Pure, so the interesting behaviour is
 * testable without a database.
 *
 * A fixed window permits a burst of up to 2× the limit across a window
 * boundary (limit requests at 0:59, limit more at 1:01). That is a real
 * property, not an oversight: we are protecting an upstream API from sustained
 * hammering, and a doubled burst for one second is far cheaper than the sorted
 * set a sliding window needs. If a source ever complains, swap the store —
 * `RateLimitStore` is the seam that makes that a contained change.
 */
export function decide(
  state: CounterState,
  rule: RateLimitRule,
  now: Date,
): RateLimitDecision {
  const resetAt = new Date(state.windowStart.getTime() + rule.windowSeconds * 1000);
  const msRemaining = resetAt.getTime() - now.getTime();

  return {
    allowed: state.hits <= rule.limit,
    limit: rule.limit,
    remaining: Math.max(0, rule.limit - state.hits),
    resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil(msRemaining / 1000)),
    degraded: false,
  };
}
