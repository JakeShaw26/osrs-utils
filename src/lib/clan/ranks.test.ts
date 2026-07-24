import { describe, it, expect } from 'vitest';
import { buildRankIndex, rankOf, sortByRank, groupByRank, formatRole } from './ranks';

/**
 * The fixture is the REAL roleOrders payload from Void Reavers (WOM group
 * 25092, fetched 2026-07-24), not invented data. Its indices are sparse —
 * 0,1,5,6,9,12,13,14,21,… — which is the property most likely to be broken by
 * someone assuming index means array position.
 */
const ROLE_ORDERS = [
  { role: 'owner', index: 0 },
  { role: 'deputy_owner', index: 1 },
  { role: 'moderator', index: 5 },
  { role: 'firestarter', index: 6 },
  { role: 'diamond', index: 9 },
  { role: 'artisan', index: 12 },
  { role: 'carry', index: 13 },
  { role: 'skulled', index: 14 },
  { role: 'colonel', index: 21 },
  { role: 'commander', index: 22 },
  { role: 'sergeant', index: 23 },
  { role: 'novice', index: 24 },
  { role: 'corporal', index: 25 },
  { role: 'recruit', index: 26 },
];

const member = (displayName: string, role: string | null) => ({
  role,
  player: { displayName },
});

describe('buildRankIndex / rankOf', () => {
  it("preserves the group's sparse indices verbatim", () => {
    const index = buildRankIndex(ROLE_ORDERS);
    expect(rankOf('owner', index)).toBe(0);
    expect(rankOf('moderator', index)).toBe(5);
    expect(rankOf('recruit', index)).toBe(26);
  });

  it('returns null for a role the group has not ordered', () => {
    const index = buildRankIndex(ROLE_ORDERS);
    expect(rankOf('gnome_child', index)).toBeNull();
    expect(rankOf(null, index)).toBeNull();
  });
});

describe('sortByRank', () => {
  it('orders by rank, highest first', () => {
    const sorted = sortByRank(
      [
        member('Recruit Guy', 'recruit'),
        member('Boss', 'owner'),
        member('Mod', 'moderator'),
      ],
      ROLE_ORDERS,
    );
    expect(sorted.map((m) => m.player.displayName)).toEqual([
      'Boss',
      'Mod',
      'Recruit Guy',
    ]);
  });

  it('breaks ties alphabetically within a rank', () => {
    const sorted = sortByRank(
      [member('Zara', 'colonel'), member('Adam', 'colonel'), member('Mia', 'colonel')],
      ROLE_ORDERS,
    );
    expect(sorted.map((m) => m.player.displayName)).toEqual(['Adam', 'Mia', 'Zara']);
  });

  /**
   * A member can hold a rank the group later dropped from its ordering. That
   * must degrade to "shown last", never to a thrown error — one stale
   * membership should not blank the entire roster page.
   */
  it('places unranked and unknown roles last rather than throwing', () => {
    const sorted = sortByRank(
      [member('Ghost', 'deleted_rank'), member('Nobody', null), member('Boss', 'owner')],
      ROLE_ORDERS,
    );
    expect(sorted[0]?.player.displayName).toBe('Boss');
    expect(
      sorted
        .slice(1)
        .map((m) => m.player.displayName)
        .sort(),
    ).toEqual(['Ghost', 'Nobody']);
  });

  /**
   * Callers pass the cached upstream response straight in. An in-place sort
   * would mutate a cache entry shared by every visitor — a bug that only shows
   * up under concurrency, which is the worst kind to debug.
   */
  it('does not mutate its input', () => {
    const input = [member('Recruit Guy', 'recruit'), member('Boss', 'owner')];
    const before = input.map((m) => m.player.displayName);
    sortByRank(input, ROLE_ORDERS);
    expect(input.map((m) => m.player.displayName)).toEqual(before);
  });

  it('sorts an empty roster without complaint', () => {
    expect(sortByRank([], ROLE_ORDERS)).toEqual([]);
  });
});

describe('groupByRank', () => {
  it('buckets members under each rank, in rank order', () => {
    const grouped = groupByRank(
      [
        member('Recruit Guy', 'recruit'),
        member('Boss', 'owner'),
        member('Deputy A', 'deputy_owner'),
        member('Deputy B', 'deputy_owner'),
      ],
      ROLE_ORDERS,
    );
    expect(grouped.map((g) => [g.role, g.members.length])).toEqual([
      ['owner', 1],
      ['deputy_owner', 2],
      ['recruit', 1],
    ]);
  });
});

describe('formatRole', () => {
  it('renders OSRS rank names the way the game does', () => {
    expect(formatRole('deputy_owner')).toBe('Deputy Owner');
    expect(formatRole('gnome_child')).toBe('Gnome Child');
    expect(formatRole('owner')).toBe('Owner');
  });

  it('labels missing roles rather than rendering an empty cell', () => {
    expect(formatRole(null)).toBe('Unranked');
  });
});
