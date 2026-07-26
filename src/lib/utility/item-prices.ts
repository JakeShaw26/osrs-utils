import 'server-only';
import {
  fetchItemMapping,
  fetchLatestPrices,
  indexMappingByName,
  midPrice,
} from '@/lib/api/prices';
import { COMMON_WILDERNESS_ITEMS, type PricedItem } from './death-risk';

/**
 * Prices the curated wilderness gear list, server-side.
 *
 * ─── WHY A CURATED LIST AND NOT A SEARCH BOX ────────────────────────────────
 *
 * A free-text item search would need a route that hits the Wiki on every
 * keystroke. With no auth, every visitor is anonymous and untrusted, so that
 * route is an open proxy pointed at someone else's server — the exact shape
 * hard rule #5 and ADR-0013 exist to stop. The defence order is
 * pre-aggregate → cache → rate limit, and this is the first step: a fixed list
 * resolved against the two bulk responses that are already cached, costing zero
 * extra upstream requests however many people open the page, and shipping ~30
 * rows to the browser instead of the 4,000-entry mapping.
 *
 * ─── WHY FAILURE IS A RETURN VALUE, NOT AN EXCEPTION ────────────────────────
 *
 * CI builds with **no secrets**, so `getEnv()` throws inside `osrsFetch` during
 * `next build`. A page that lets that propagate fails the build for a reason
 * that has nothing to do with the page. Returning a degraded catalogue instead
 * keeps the calculator fully usable with hand-entered values and makes the
 * missing prices visible on screen rather than as a stack trace.
 */

export type { PricedItem };

export interface ItemCatalogue {
  items: PricedItem[];
  /** Curated names the mapping did not match — a renamed item, most likely. */
  missing: string[];
  /** Curated names that matched but have no current two-sided price. */
  unpriced: string[];
  /** Null when the catalogue loaded; a short reason when it did not. */
  error: string | null;
}

export async function fetchWildernessItemCatalogue(): Promise<ItemCatalogue> {
  try {
    // Two bulk requests, both shared cache entries. Not one request per item —
    // that is `assertNoFanOut`'s whole subject.
    const [mapping, latest] = await Promise.all([
      fetchItemMapping(),
      fetchLatestPrices(),
    ]);

    const byName = indexMappingByName(mapping);
    const items: PricedItem[] = [];
    const missing: string[] = [];
    const unpriced: string[] = [];

    for (const name of COMMON_WILDERNESS_ITEMS) {
      const entry = byName.get(name.toLowerCase());
      if (!entry) {
        missing.push(name);
        continue;
      }

      const price = midPrice(latest[String(entry.id)]);
      if (price === null) {
        // midPrice returns null rather than falling back to one side, so an
        // illiquid item is reported as unpriced instead of quietly understating
        // someone's risk by a few million.
        unpriced.push(entry.name);
        continue;
      }

      items.push({ id: String(entry.id), name: entry.name, unitValue: price });
    }

    items.sort((a, b) => a.name.localeCompare(b.name));
    return { items, missing, unpriced, error: null };
  } catch (cause) {
    return {
      items: [],
      missing: [],
      unpriced: [],
      error:
        cause instanceof Error
          ? `Live prices unavailable: ${cause.message.split('\n')[0]}`
          : 'Live prices unavailable.',
    };
  }
}
