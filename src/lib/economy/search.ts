import type { ItemMapping } from '@/lib/api/prices';

/**
 * Item-name search, as pure logic over an already-fetched mapping.
 *
 * There is no search API and we do not want one. `/mapping` is a single ~850 KB
 * response covering every tradeable item, cached upstream for a day, so
 * searching it in memory costs one shared fetch for the entire app rather than
 * one upstream request per keystroke per visitor. That is the difference
 * between a feature and an open proxy (ADR-0013).
 *
 * Ranking is deliberately simple and explainable — exact, then prefix, then
 * substring, then alphabetical. A fuzzy matcher would need a dependency and
 * would make "why is Dragon dagger 8th?" unanswerable.
 */

export type MatchKind = 'exact' | 'prefix' | 'word-prefix' | 'substring';

export interface ItemSearchResult {
  item: ItemMapping;
  kind: MatchKind;
}

/** Rank order. Lower sorts first. */
const KIND_RANK: Record<MatchKind, number> = {
  exact: 0,
  prefix: 1,
  'word-prefix': 2,
  substring: 3,
};

/**
 * Normalises a query for comparison.
 *
 * Apostrophes are stripped rather than escaped: OSRS item names are full of
 * them (`Zamorak's grip`, `Verac's flail`) and a player searching "veracs"
 * expects a hit. Note this is a *display* concern only — nothing here is
 * interpolated into an upstream query, so it is not the injection boundary that
 * `buildBucketQuery` is.
 */
export function normaliseQuery(raw: string): string {
  return raw.toLowerCase().replace(/['’]/g, '').replace(/\s+/g, ' ').trim();
}

function classify(name: string, query: string): MatchKind | null {
  if (name === query) return 'exact';
  if (name.startsWith(query)) return 'prefix';
  const index = name.indexOf(query);
  if (index === -1) return null;
  // Matching at a word boundary ("dragon SCIMitar" vs "dragon scimITAR") is a
  // better hit than matching mid-word, so it gets its own tier.
  return name[index - 1] === ' ' ? 'word-prefix' : 'substring';
}

export interface SearchOptions {
  limit?: number;
  /**
   * Drops items with no live price. On by default: an item the GE has not
   * traded has nothing useful to show on a price page, and including them
   * pushes real results off the end of the list.
   */
  tradeableIds?: ReadonlySet<string>;
}

export function searchItems(
  mapping: readonly ItemMapping[],
  rawQuery: string,
  { limit = 50, tradeableIds }: SearchOptions = {},
): ItemSearchResult[] {
  const query = normaliseQuery(rawQuery);
  if (query === '') return [];

  const results: ItemSearchResult[] = [];

  for (const item of mapping) {
    if (tradeableIds && !tradeableIds.has(String(item.id))) continue;

    const kind = classify(normaliseQuery(item.name), query);
    if (kind === null) continue;

    results.push({ item, kind });
  }

  results.sort((a, b) => {
    const byKind = KIND_RANK[a.kind] - KIND_RANK[b.kind];
    if (byKind !== 0) return byKind;
    // Shorter names first within a tier: "Rune scimitar" should beat
    // "Rune scimitar (broken)" for the query "rune scimitar".
    const byLength = a.item.name.length - b.item.name.length;
    if (byLength !== 0) return byLength;
    return a.item.name.localeCompare(b.item.name);
  });

  return results.slice(0, limit);
}
