import 'server-only';
import {
  fetchItemMapping,
  fetchLatestPrices,
  indexMappingByName,
  midPrice,
} from '@/lib/api/prices';
import type { ItemPrices } from './types';

/**
 * Resolves authored item NAMES to live GE prices.
 *
 * WHY NAMES RATHER THAN ITEM IDS IN THE AUTHORED DATA
 *
 * The obvious design puts `itemId: 536` in training-methods.json. It was
 * rejected: a wrong id is invisible. It fetches a real price for a real, wrong
 * item, and the calculator then produces a confident, wrong number that nobody
 * can spot by reading the JSON. A wrong *name* resolves to nothing and shows up
 * as "price unavailable" — the failure announces itself.
 *
 * NO FAN-OUT (hard rule #4)
 *
 * This makes exactly two upstream requests regardless of how many items are
 * asked for, because both are bulk endpoints: `/mapping` (24h TTL) and
 * `/latest` (60s TTL). Thirty item names cost the same as one, and the same
 * two cache entries serve every visitor. Never replace this with a loop over
 * `fetchLatestPrice`.
 */

export interface PriceLookup {
  prices: ItemPrices;
  /**
   * True when the upstream could not be reached at all.
   *
   * Distinct from an item simply having no price. The page renders either way —
   * every calculator here works with prices absent — but the UI should say
   * "prices are unavailable" rather than implying thirty items are untradeable.
   */
  unavailable: boolean;
}

/**
 * Prices for the given item names, keyed by lowercased name.
 *
 * NEVER THROWS. This runs in a page render, and the app must work with no
 * secrets and no network — CI builds without `.env.local`, and the whole
 * feature is designed to degrade to "type your own prices" rather than to an
 * error page. A failure is logged and reported through `unavailable`.
 */
export async function fetchPricesForItems(
  names: readonly string[],
): Promise<PriceLookup> {
  const prices: ItemPrices = {};
  for (const name of names) prices[name.toLowerCase()] = null;

  try {
    const [mapping, latest] = await Promise.all([
      fetchItemMapping(),
      fetchLatestPrices(),
    ]);

    const byName = indexMappingByName(mapping);

    for (const name of names) {
      const item = byName.get(name.toLowerCase());
      if (!item) continue;
      prices[name.toLowerCase()] = midPrice(latest[String(item.id)]);
    }

    return { prices, unavailable: false };
  } catch (error) {
    console.error('[skilling] price lookup failed; rendering without prices', error);
    return { prices, unavailable: true };
  }
}

/** Names the GE had no usable price for. Drives the "why is this blank" note. */
export function unpricedNames(lookup: PriceLookup): string[] {
  return Object.entries(lookup.prices)
    .filter(([, price]) => price === null)
    .map(([name]) => name);
}
