import { randomUUID } from 'node:crypto';
import { eq, like } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { getDb, isLocalPostgres } from '@/lib/db';
import { rateLimitCounters } from '@/lib/db/schema';
import { postgresRateLimitStore, pruneRateLimitCounters } from './postgres-store';
import { windowStartFor, type RateLimitRule } from './types';

/**
 * The one test that needs a real database.
 *
 * Every other rate-limit test runs against the in-memory store, which proves the
 * *contract* and nothing about the SQL. That gap matters more here than it
 * usually would, because `enforceRateLimit()` fails OPEN: if the upsert is
 * malformed, or the table is missing, or the driver cannot reach Postgres, the
 * limiter swallows the error and allows the request. A limiter that has never
 * limited anything is indistinguishable from one that works — from the outside,
 * both return 200. So this asserts against the real table.
 *
 * OPT-IN, not skipped-by-accident. It runs only when DATABASE_URL points at
 * loopback, so `npm test` in CI (no database, no env) skips it rather than
 * failing. Run it with `npm run test:db`, which loads .env.local.
 */
const url = process.env.DATABASE_URL;
const hasLocalDb = Boolean(url && isLocalPostgres(url));

const KEY_PREFIX = 'test:ratelimit:';
const rule: RateLimitRule = { limit: 3, windowSeconds: 60 };

describe.skipIf(!hasLocalDb)('postgresRateLimitStore against a real Postgres', () => {
  afterAll(async () => {
    await getDb()
      .delete(rateLimitCounters)
      .where(like(rateLimitCounters.bucketKey, `${KEY_PREFIX}%`));
  });

  it('counts successive hits in the same window', async () => {
    const key = `${KEY_PREFIX}${randomUUID()}`;
    const now = new Date();

    const first = await postgresRateLimitStore.increment(key, rule, now);
    const second = await postgresRateLimitStore.increment(key, rule, now);
    const third = await postgresRateLimitStore.increment(key, rule, now);

    // The ON CONFLICT DO UPDATE has to increment, not overwrite. Overwriting
    // would pin every caller at 1 hit and never limit anyone.
    expect([first.hits, second.hits, third.hits]).toEqual([1, 2, 3]);
    expect(second.windowStart).toEqual(windowStartFor(now, rule.windowSeconds));
  });

  it('gives each window its own counter', async () => {
    const key = `${KEY_PREFIX}${randomUUID()}`;
    const now = new Date();
    const nextWindow = new Date(now.getTime() + rule.windowSeconds * 1000);

    await postgresRateLimitStore.increment(key, rule, now);
    const rolled = await postgresRateLimitStore.increment(key, rule, nextWindow);

    // A fixed window resets by writing a new row, not by clearing the old one.
    // If the primary key were bucket_key alone, this would read 2 and a caller
    // would stay limited forever.
    expect(rolled.hits).toBe(1);
  });

  it('loses no increments when they arrive concurrently', async () => {
    const key = `${KEY_PREFIX}${randomUUID()}`;
    const now = new Date();
    const parallel = 20;

    const results = await Promise.all(
      Array.from({ length: parallel }, () =>
        postgresRateLimitStore.increment(key, rule, now),
      ),
    );

    // The reason the store is one statement rather than SELECT-then-UPDATE.
    // A read-then-write races here and returns duplicate counts, which leaks
    // limit under exactly the concurrency the limiter exists for — and passes
    // every single-threaded test.
    const hits = results.map((r) => r.hits).sort((a, b) => a - b);
    expect(hits).toEqual(Array.from({ length: parallel }, (_, i) => i + 1));
  });

  it('prunes closed windows and leaves open ones alone', async () => {
    const expired = `${KEY_PREFIX}${randomUUID()}`;
    const live = `${KEY_PREFIX}${randomUUID()}`;
    const longAgo = new Date(Date.now() - 60 * 60 * 1000);
    const now = new Date();

    await postgresRateLimitStore.increment(expired, rule, longAgo);
    await postgresRateLimitStore.increment(live, rule, now);

    await pruneRateLimitCounters(now);

    expect(await countRowsFor(expired)).toBe(0);
    expect(await countRowsFor(live)).toBe(1);
  });
});

async function countRowsFor(key: string): Promise<number> {
  const rows = await getDb()
    .select({ hits: rateLimitCounters.hits })
    .from(rateLimitCounters)
    .where(eq(rateLimitCounters.bucketKey, key));

  return rows.length;
}
