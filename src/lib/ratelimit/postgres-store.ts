import 'server-only';
import { lt, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { rateLimitCounters } from '@/lib/db/schema';
import { windowStartFor, type CounterState, type RateLimitRule } from './types';

/**
 * Rate-limit counters in Postgres.
 *
 * Postgres was already a dependency and `job_state` set the precedent for
 * "small operational table", so this needs no new infrastructure and no new
 * vendor. Upstash Redis would be faster and expire rows for us; it is the
 * upgrade path, not the starting point. (ADR-0013)
 */
export const postgresRateLimitStore = {
  name: 'postgres',

  async increment(key: string, rule: RateLimitRule, now: Date): Promise<CounterState> {
    const windowStart = windowStartFor(now, rule.windowSeconds);
    const expiresAt = new Date(windowStart.getTime() + rule.windowSeconds * 1000);

    /**
     * One statement, so the read and the write cannot be interleaved by another
     * invocation. `INSERT … ON CONFLICT DO UPDATE … RETURNING` is what makes
     * this correct across instances; a `SELECT` followed by an `UPDATE` would
     * lose increments under precisely the concurrency the limiter exists for.
     */
    const rows = await getDb()
      .insert(rateLimitCounters)
      .values({ bucketKey: key, windowStart, hits: 1, expiresAt })
      .onConflictDoUpdate({
        target: [rateLimitCounters.bucketKey, rateLimitCounters.windowStart],
        set: { hits: sql`${rateLimitCounters.hits} + 1` },
      })
      .returning({ hits: rateLimitCounters.hits });

    // An upsert with RETURNING yields exactly one row by construction; the
    // assertion narrows what noUncheckedIndexedAccess cannot know.
    return { hits: rows[0]!.hits, windowStart };
  },
};

/**
 * Deletes closed windows. Call from a `CRON_SECRET`-protected job.
 *
 * Nothing breaks if this never runs — expired rows are simply never read again,
 * because the key includes the window start. The table just grows. Postgres
 * has no TTL, which is the one real advantage Redis has here.
 */
export async function pruneRateLimitCounters(now = new Date()): Promise<void> {
  await getDb().delete(rateLimitCounters).where(lt(rateLimitCounters.expiresAt, now));
}
