import {
  pgTable,
  text,
  timestamp,
  bigint,
  integer,
  jsonb,
  uuid,
  date,
  index,
  primaryKey,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/**
 * Schema for a public, read-only app (ADR-0012).
 *
 * Persisted here = we are the source of truth, or there is no external one.
 * NOT here (deliberately): GE prices, item/monster stats, live hiscores, WOM
 * rosters and history. Those have an authoritative upstream; copying them into
 * our database only manufactures staleness bugs. Cache them, don't store them.
 *
 * WHY THIS IS SO SMALL
 *
 * It used to hold fourteen tables. Removing authentication removed the reason
 * for ten of them: identity, RSN links and their approval queue, self-declared
 * quest/diary/CA progress, timers, inventories, flip logs, custom events and
 * their completions, and the audit log were all *per-account* state. With no
 * accounts, per-user data lives in the member's own browser instead
 * (localStorage/IndexedDB), which is both simpler and better for them.
 *
 * What is left is not user data at all. Neither table is keyed by a person —
 * only by RSN and by job name — so neither depended on auth to be meaningful.
 *
 * SECURITY (ADR-0012): no *application* state here may be written in response to
 * an anonymous request. The only writers are `CRON_SECRET`-authenticated
 * scheduled jobs. A route handler that mutates `daily_snapshots` for a public
 * caller is a defect.
 *
 * `rate_limit_counters` is the one deliberate exception, and the exception is
 * narrow enough to state precisely: see ADR-0013 and the comment on the table.
 */

/**
 * Thin daily snapshot of clan XP. Wise Old Man is the system of record for
 * tracking (ADR-0002); this exists only so a WOM outage degrades the clan layer
 * to "stale" rather than "empty". Keep it narrow — do not mirror WOM.
 *
 * Keyed by RSN because that is now the only identity the app has.
 */
export const dailySnapshots = pgTable(
  'daily_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    rsnNormalised: text('rsn_normalised').notNull(),
    snapshotDate: date('snapshot_date').notNull(),
    overallXp: bigint('overall_xp', { mode: 'bigint' }),
    metrics: jsonb('metrics').notNull().default({}),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Idempotency for the chunked refresh job: a replayed chunk upserts rather
    // than duplicating. (PRD §4.5)
    uniqueIndex('daily_snapshots_key').on(t.rsnNormalised, t.snapshotDate),
  ],
);

/**
 * Cursor for the chunked refresh job. Serverless invocations can be killed
 * mid-run, so progress must be durable and resumable. `lastCompletedPassAt`
 * drives the staleness warning that stops a stuck job going unnoticed.
 */
export const jobState = pgTable('job_state', {
  job: text('job').primaryKey(),
  cursor: text('cursor'),
  lastRunAt: timestamp('last_run_at', { withTimezone: true }),
  lastCompletedPassAt: timestamp('last_completed_pass_at', { withTimezone: true }),
  lastError: text('last_error'),
});

/**
 * Fixed-window rate-limit counters. The one table an anonymous request writes.
 *
 * WHY THIS DOESN'T BREAK HARD RULE #5 (ADR-0013)
 *
 * Rule #5 bans a public caller mutating *application* state. This is not
 * application state — it is a counter, and the exception is bounded in every
 * direction that matters:
 *
 *   - The caller supplies no content. Both key columns are derived server-side;
 *     `bucket_key` is a SHA-256 digest and `window_start` is a quantised clock
 *     reading. There is no field an attacker can choose the bytes of.
 *   - It is write-only-by-increment. The single statement that touches it adds
 *     one to an integer; nothing here is ever read back into a page.
 *   - Deleting the whole table costs nothing but a brief loss of limiting.
 *
 * PRIVACY: `bucket_key` is a salted hash, never a raw IP. An IP address is
 * personal data, and IPv4 is small enough (2^32) to brute-force from an
 * unsalted digest — so a database dump must not become a visitor log.
 *
 * The composite primary key is load-bearing: it is the ON CONFLICT target that
 * makes "increment or create" a single atomic statement rather than a
 * read-then-write race between concurrent serverless invocations.
 */
export const rateLimitCounters = pgTable(
  'rate_limit_counters',
  {
    bucketKey: text('bucket_key').notNull(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    hits: integer('hits').notNull().default(0),
    /** Drives pruning. Rows are dead weight the moment their window closes. */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.bucketKey, t.windowStart] }),
    index('rate_limit_counters_expires_at').on(t.expiresAt),
  ],
);
