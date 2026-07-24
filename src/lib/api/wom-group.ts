import 'server-only';
import { osrsFetch } from './osrs-fetch';
import { getEnv } from '@/lib/env';
import type { RoleOrder } from '@/lib/clan/ranks';

/**
 * The clan's Wise Old Man group — roster, ranks, leaderboards, competitions.
 *
 * This is the whole clan layer. With no accounts (ADR-0012), WOM group
 * membership *is* the roster and the group's `roleOrders` *is* the rank
 * hierarchy.
 *
 * CACHING IS A SECURITY CONTROL HERE, NOT A PERFORMANCE TWEAK.
 *
 * Every visitor is anonymous and sees identical data, so one upstream fetch can
 * serve everyone. That matters because the app is public: without a shared
 * cache our outbound request rate scales with inbound traffic, and a stranger
 * can make us hammer WOM from our IP until we are blocked. `osrsFetch` applies
 * Next's shared `revalidate` cache, keyed by URL rather than by visitor.
 * (PRD §5.3, docs/api-terms.md)
 *
 * Verified behaviour is recorded in docs/api-notes/wise-old-man-groups.md —
 * read it before assuming a field's shape.
 */

export interface WomPlayer {
  id: number;
  username: string;
  displayName: string;
  type: string;
  build: string;
  status: string;
  country: string | null;
  exp: number;
  ehp: number;
  ehb: number;
  ttm: number;
  /** When WOM last refreshed this player. Surface it — do not imply freshness. */
  updatedAt: string;
  lastChangedAt: string | null;
}

export interface WomMembership {
  playerId: number;
  groupId: number;
  role: string | null;
  createdAt: string;
  updatedAt: string;
  player: WomPlayer;
}

export interface WomGroup {
  id: number;
  name: string;
  clanChat: string | null;
  description: string | null;
  homeworld: number | null;
  verified: boolean;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
  roleOrders: RoleOrder[];
  memberships: WomMembership[];
}

export interface WomGained {
  player: WomPlayer;
  startDate: string;
  endDate: string;
  data: { gained: number; start: number; end: number };
}

export interface WomCompetition {
  id: number;
  title: string;
  type: string;
  metric: string;
  metrics: string[] | null;
  startsAt: string;
  endsAt: string;
  participantCount: number;
}

export type WomPeriod = 'day' | 'week' | 'month' | 'year';

/**
 * The full roster in ONE request — memberships are not paginated (verified:
 * 78 of 78 for our group, 488 of 488 for a larger one). This is why clan views
 * never need to fan out across members (hard rule #4).
 */
export async function fetchClanGroup(): Promise<WomGroup> {
  return osrsFetch<WomGroup>('wom', `/groups/${getEnv().WOM_GROUP_ID}`);
}

/**
 * A ranked leaderboard, pre-aggregated by WOM. One request, already sorted.
 *
 * Never compute this by iterating members — that is the fan-out this codebase
 * exists to avoid.
 *
 * Note the row count does NOT match `memberCount`: members with no gain in the
 * period are omitted (485 rows for 488 members, verified). Never index one list
 * by the other.
 */
export async function fetchClanGained(
  metric: string,
  period: WomPeriod,
  limit = 50,
): Promise<WomGained[]> {
  return osrsFetch<WomGained[]>('wom', `/groups/${getEnv().WOM_GROUP_ID}/gained`, {
    searchParams: { metric, period, limit },
  });
}

/**
 * Competitions replace the custom clan events dropped in ADR-0012. Returned
 * newest-first and unfiltered, so callers pick upcoming/ongoing/past themselves.
 */
export async function fetchClanCompetitions(): Promise<WomCompetition[]> {
  return osrsFetch<WomCompetition[]>(
    'wom',
    `/groups/${getEnv().WOM_GROUP_ID}/competitions`,
  );
}
