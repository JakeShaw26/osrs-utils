import {
  pgTable,
  text,
  timestamp,
  bigint,
  jsonb,
  uuid,
  date,
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
 * SECURITY (ADR-0012): nothing here may be written in response to an anonymous
 * request. The only writers are `CRON_SECRET`-authenticated scheduled jobs. A
 * route handler that mutates these tables for a public caller is a defect.
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
