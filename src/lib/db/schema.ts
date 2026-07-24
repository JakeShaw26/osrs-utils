import { sql, type SQL } from 'drizzle-orm';
import {
  pgTable,
  text,
  timestamp,
  integer,
  bigint,
  boolean,
  jsonb,
  uuid,
  date,
  uniqueIndex,
  index,
  pgEnum,
  type PgColumn,
} from 'drizzle-orm/pg-core';

/** Partial-index helper: `WHERE <col>` for boolean columns. */
function sqlTrue(column: PgColumn): SQL {
  return sql`${column}`;
}

/**
 * Schema for entities decided in PRD §4.4.
 *
 * Persisted here = we are the source of truth, or there is no external one.
 * NOT here (deliberately): GE prices, item/monster stats, live hiscores, WOM
 * history. Those have an authoritative upstream; copying them into our database
 * only manufactures staleness bugs. Cache them, don't store them.
 *
 * Nothing writes to these tables yet — this is scaffolding. Tables exist now so
 * feature work adds queries, not migrations-plus-queries.
 */

/* -------------------------------------------------------------------------- */
/* Enums                                                                       */
/* -------------------------------------------------------------------------- */

export const clanRole = pgEnum('clan_role', [
  'guest',
  'applicant',
  'member',
  'officer',
  'admin',
]);

export const linkRequestStatus = pgEnum('link_request_status', [
  'pending',
  'approved',
  'rejected',
  'superseded', // auto-rejected because a competing claim for the same RSN won
]);

/** The three self-report flows share one table — see PRD §4.4. */
export const declarationKind = pgEnum('declaration_kind', [
  'quest',
  'diary',
  'combat_achievement',
]);

/* -------------------------------------------------------------------------- */
/* Identity                                                                    */
/* -------------------------------------------------------------------------- */

export const members = pgTable(
  'members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    discordId: text('discord_id').notNull(),
    discordUsername: text('discord_username').notNull(),
    discordAvatar: text('discord_avatar'),

    /**
     * Cached role, refreshed from Discord. NOT authoritative on its own:
     * privileged routes must revalidate against Discord and fail CLOSED on
     * error. Never widen access from a cached value. (PRD §5.2)
     */
    cachedRole: clanRole('cached_role').notNull().default('guest'),
    rolesCheckedAt: timestamp('roles_checked_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('members_discord_id_key').on(t.discordId)],
);

export const rsnLinks = pgTable(
  'rsn_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),

    /** Lowercased, whitespace-normalised, for the uniqueness constraint. */
    rsnNormalised: text('rsn_normalised').notNull(),
    /** As displayed in game. */
    rsnDisplay: text('rsn_display').notNull(),

    /**
     * One member may hold several RSNs (main + ironman + alts), but exactly one
     * is primary. Leaderboards read only the primary link, otherwise alts could
     * be used to occupy several leaderboard slots. (PRD §5.3)
     */
    isPrimary: boolean('is_primary').notNull().default(false),

    approvedBy: uuid('approved_by').references(() => members.id),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // An RSN belongs to at most one member. Without this, two members claim the
    // same account and every leaderboard is wrong.
    uniqueIndex('rsn_links_rsn_key').on(t.rsnNormalised),
    uniqueIndex('rsn_links_one_primary_per_member')
      .on(t.memberId)
      .where(sqlTrue(t.isPrimary)),
    index('rsn_links_member_idx').on(t.memberId),
  ],
);

/**
 * Officer approval queue (PRD §5.3).
 * Separate from rsn_links because a request is not a link: several members may
 * have a pending claim on one RSN, which the unique constraint above forbids.
 * Approving one supersedes the rest.
 */
export const rsnLinkRequests = pgTable(
  'rsn_link_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    rsnNormalised: text('rsn_normalised').notNull(),
    rsnDisplay: text('rsn_display').notNull(),
    status: linkRequestStatus('status').notNull().default('pending'),
    resolvedBy: uuid('resolved_by').references(() => members.id),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolutionNote: text('resolution_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('rsn_link_requests_status_idx').on(t.status),
    index('rsn_link_requests_rsn_idx').on(t.rsnNormalised),
  ],
);

/* -------------------------------------------------------------------------- */
/* Member-supplied data                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Quests, diaries and combat achievements: three features, one shape —
 * "member asserts an unverifiable fact". None are in the hiscores (verified,
 * PRD §2.4), so all are self-reported and none may feed a ranked leaderboard.
 */
export const memberDeclarations = pgTable(
  'member_declarations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    kind: declarationKind('kind').notNull(),
    /** Stable slug, e.g. 'dragon_slayer_ii', 'karamja_elite'. */
    key: text('key').notNull(),
    value: jsonb('value').notNull().default({}),
    declaredAt: timestamp('declared_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('member_declarations_key').on(t.memberId, t.kind, t.key)],
);

/** Farm-run and other timers. Server-side so they survive a device change. */
export const memberTimers = pgTable(
  'member_timers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(), // 'herb_run' | 'birdhouse' | ...
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    notified: boolean('notified').notNull().default(false),
  },
  (t) => [index('member_timers_due_idx').on(t.dueAt, t.notified)],
);

/**
 * Declared item holdings for the account value estimator. No API exposes a
 * player's bank, so this is member-entered and must be labelled an estimate of
 * declared items — never "net worth". (PRD §3.5)
 */
export const memberInventoryItems = pgTable(
  'member_inventory_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    itemId: integer('item_id').notNull(),
    quantity: bigint('quantity', { mode: 'bigint' }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('member_inventory_key').on(t.memberId, t.itemId)],
);

/** Self-reported flips. Unverifiable, so excluded from ranked leaderboards. */
export const flippingLogs = pgTable(
  'flipping_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    itemId: integer('item_id').notNull(),
    quantity: integer('quantity').notNull(),
    buyPrice: bigint('buy_price', { mode: 'bigint' }).notNull(),
    sellPrice: bigint('sell_price', { mode: 'bigint' }).notNull(),
    /** Stored, not recomputed: GE tax rules change, and history shouldn't move. */
    taxPaid: bigint('tax_paid', { mode: 'bigint' }).notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('flipping_logs_member_idx').on(t.memberId, t.createdAt)],
);

/* -------------------------------------------------------------------------- */
/* Clan state                                                                  */
/* -------------------------------------------------------------------------- */

/** Discord role ID -> app permission tier. Config, never hardcoded. (PRD §5.4) */
export const clanConfig = pgTable('clan_config', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  kind: text('kind').notNull(), // 'bingo' | 'skilling_comp' | 'pvm_comp'
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  config: jsonb('config').notNull().default({}),
  createdBy: uuid('created_by').references(() => members.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A tile is either auto-scored (an XP/KC threshold WOM can confirm) or
 * manually verified by an officer (a drop, which nothing can confirm).
 * Both paths exist from day one because retrofitting manual approval into an
 * auto-scored model is painful. (PRD §3.8)
 */
export const eventTiles = pgTable('event_tiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  points: integer('points').notNull().default(1),
  autoVerifiable: boolean('auto_verifiable').notNull().default(false),
  /** WOM metric + threshold when autoVerifiable. */
  criteria: jsonb('criteria').notNull().default({}),
});

export const eventCompletions = pgTable(
  'event_completions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tileId: uuid('tile_id')
      .notNull()
      .references(() => eventTiles.id, { onDelete: 'cascade' }),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    verifiedBy: uuid('verified_by').references(() => members.id),
    evidenceUrl: text('evidence_url'),
    completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('event_completions_key').on(t.tileId, t.memberId)],
);

/* -------------------------------------------------------------------------- */
/* Tracking + operations                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Thin daily snapshot. Wise Old Man is the system of record for tracking
 * (ADR-0002); this exists only so a WOM outage degrades the clan layer to
 * "stale" rather than "empty". Keep it narrow — do not mirror WOM. (PRD §9/R2)
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

/** Append-only. Admin-read-only. Never mutated through the app. (PRD §5.4) */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id').references(() => members.id),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_log_created_idx').on(t.createdAt)],
);
