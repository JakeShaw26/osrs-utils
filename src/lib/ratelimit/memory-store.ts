import {
  windowStartFor,
  type CounterState,
  type RateLimitRule,
  type RateLimitStore,
} from './types';

/**
 * In-process counters. **For tests only.**
 *
 * ⚠️ This is the wrong implementation for production, and the reason is worth
 * internalising because the shape recurs (sessions, caches, job locks, feature
 * flags): serverless invocations do not share memory. Ten warm instances means
 * ten independent Maps, so a "30 per minute" limit admits 300 per minute — and
 * it fails in the direction you cannot see, because every instance's counter
 * looks correct from inside.
 *
 * It is not wired up as a development fallback either. Dev running a different
 * store from production is how "works locally" bugs are manufactured; the real
 * store needs only `DATABASE_URL`, which development already has.
 */
export function createMemoryRateLimitStore(): RateLimitStore & { reset(): void } {
  const counters = new Map<string, number>();

  return {
    name: 'memory',

    async increment(key: string, rule: RateLimitRule, now: Date): Promise<CounterState> {
      const windowStart = windowStartFor(now, rule.windowSeconds);
      const composite = `${key}@${windowStart.getTime()}`;

      const hits = (counters.get(composite) ?? 0) + 1;
      counters.set(composite, hits);

      return { hits, windowStart };
    },

    reset() {
      counters.clear();
    },
  };
}
