/**
 * Clan rank ordering, derived from the group's own `roleOrders`.
 *
 * WHY THERE IS NO HARDCODED RANK LADDER
 *
 * OSRS clans choose which of ~40 ranks they use and in what order, and they
 * change it. Wise Old Man returns each group's ordering as `roleOrders`, so the
 * hierarchy is *clan-supplied data*. Hardcoding it would mean a code change
 * every time an officer reshuffles ranks, and would silently mis-order any
 * group but ours. (ADR-0012)
 *
 * Pure functions, no fetching — see `lib/api/wom-group.ts` for that. Keeping
 * them apart is what makes the ordering testable without a network call.
 */

/** Structural, so this module does not depend on the API layer. */
export interface RoleOrder {
  role: string;
  index: number;
}

export interface RankedMember {
  role: string | null;
  player: { displayName: string };
}

/**
 * Lowest index = highest rank.
 *
 * Indices are **sparse and arbitrary** — Void Reavers uses
 * 0,1,5,6,9,12,13,14,21,22,23,24,25,26. Never treat one as an array position,
 * a count, or a percentage; only ever compare two of them.
 */
export function buildRankIndex(
  roleOrders: readonly RoleOrder[],
): ReadonlyMap<string, number> {
  return new Map(roleOrders.map((r) => [r.role, r.index]));
}

/**
 * `null` for a role the group has not ordered.
 *
 * This is reachable: a member can hold a rank that was removed from the group's
 * ordering. Returning null and sorting those last beats throwing — one odd
 * membership should not blank the whole roster page.
 */
export function rankOf(
  role: string | null,
  index: ReadonlyMap<string, number>,
): number | null {
  if (!role) return null;
  return index.get(role) ?? null;
}

/**
 * Sorts by rank, then alphabetically within a rank. Unranked members go last.
 *
 * Returns a new array — callers often hold the cached upstream response, and
 * sorting it in place would mutate a shared cache entry.
 */
export function sortByRank<T extends RankedMember>(
  members: readonly T[],
  roleOrders: readonly RoleOrder[],
): T[] {
  const index = buildRankIndex(roleOrders);

  return [...members].sort((a, b) => {
    const ra = rankOf(a.role, index);
    const rb = rankOf(b.role, index);

    if (ra === null && rb === null) return compareNames(a, b);
    if (ra === null) return 1;
    if (rb === null) return -1;
    if (ra !== rb) return ra - rb;

    return compareNames(a, b);
  });
}

function compareNames(a: RankedMember, b: RankedMember): number {
  return a.player.displayName.localeCompare(b.player.displayName, 'en');
}

/** Groups members by rank, in rank order. Unranked members land under `null`. */
export function groupByRank<T extends RankedMember>(
  members: readonly T[],
  roleOrders: readonly RoleOrder[],
): { role: string | null; members: T[] }[] {
  const sorted = sortByRank(members, roleOrders);
  const out: { role: string | null; members: T[] }[] = [];

  for (const member of sorted) {
    const last = out[out.length - 1];
    if (last && last.role === member.role) last.members.push(member);
    else out.push({ role: member.role, members: [member] });
  }

  return out;
}

/**
 * `deputy_owner` -> `Deputy Owner`.
 *
 * OSRS rank names are proper nouns in-game ("Deputy Owner", "Gnome Child"), so
 * title case matches what members see in the clan interface.
 */
export function formatRole(role: string | null): string {
  if (!role) return 'Unranked';
  return role
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
