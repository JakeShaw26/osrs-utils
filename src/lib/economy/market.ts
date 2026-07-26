import 'server-only';
import {
  fetchAveragePrices,
  fetchItemMapping,
  fetchLatestPrices,
  type AveragePrice,
  type ItemMapping,
  type LatestPrice,
} from '@/lib/api/prices';
import { NATURE_RUNE_ITEM_ID } from './alch';

/**
 * The one place economy pages get market data.
 *
 * WHY THIS IS THE WHOLE SECURITY DESIGN OF THE FEATURE
 *
 * Every function here reads exactly three upstream endpoints — `/mapping`,
 * `/latest` and `/5m` — and all three are BULK: one response covers every item
 * in the game. So the number of upstream requests this feature makes is a
 * function of time (the cache TTL) and nothing else. It does not scale with
 * visitors, with how many items they search for, or with how hard someone
 * hammers us. A stranger scripting our public URLs cannot turn that into
 * outbound traffic against the Wiki.
 *
 * That is line 1 and line 2 of the defence in ADR-0013 — pre-aggregation, then
 * a cache shared by every visitor — and it is why nothing in this feature needs
 * `enforceRateLimit()`. The moment someone adds a per-item upstream call on a
 * request path, that stops being true. The one endpoint with that shape is
 * `/timeseries`; see `loadItemHistory` for how it is bounded.
 *
 * ⚠️ **Line 2 is not automatic — it is a property of the CALLING PAGE.** The
 * TTLs `osrsFetch` sets are only honoured if the page keeps its data cache.
 * Every economy page therefore declares `fetchCache = 'default-cache'`, and a
 * page that instead declares `dynamic = 'force-dynamic'` silently overrides all
 * of them (it is documented as equivalent to `fetchCache = 'force-no-store'`,
 * which re-fetches "even if they provide a 'force-cache' option"). Everything
 * above this line was written as fact while that was exactly what shipped, so
 * the paragraph read as a guarantee while the feature was an open proxy. If you
 * add an economy page, the caching declaration is the thing to get right —
 * lint blocks the specific mistake we made, not every way to make it.
 * See ADR-0014.
 *
 * `server-only`: importing this from a client component is a build error, which
 * is the guarantee that a 850 KB mapping never ships to a browser.
 */

/** One item, with everything the economy UI needs, already joined. */
export interface MarketRow {
  id: number;
  name: string;
  examine: string;
  members: boolean;
  icon: string;
  /** GE buy limit per 4 hours. Null when the item has none. */
  buyLimit: number | null;
  /** `highalch` from /mapping. Null on unalchable items. */
  highAlch: number | null;
  /** Instant-buy price — what you pay to buy now. Null when never traded. */
  buyPrice: number | null;
  /** Instant-sell price — what you receive selling now. */
  sellPrice: number | null;
  /** Unix seconds of the most recent trade on either side. Null when unknown. */
  lastTradedAt: number | null;
  /** Items traded in the most recent 5-minute block, both sides summed. */
  recentVolume: number | null;
  /** Raw /5m entry, for the liquidity assessment. */
  fiveMinute: AveragePrice | null;
}

/**
 * `/latest` names its fields from the market's perspective; the UI needs them
 * from the player's. `high` is the most recent instant-BUY, which is what YOU
 * receive when selling. Flipping this mapping silently inverts every margin in
 * the app, so it happens exactly once, here.
 */
function toMarketRow(
  item: ItemMapping,
  latest: LatestPrice | undefined,
  fiveMinute: AveragePrice | undefined,
): MarketRow {
  const buyPrice = latest?.low ?? null;
  const sellPrice = latest?.high ?? null;

  const times = [latest?.highTime, latest?.lowTime].filter(
    (time): time is number => typeof time === 'number',
  );

  const volume =
    fiveMinute === undefined
      ? null
      : (fiveMinute.highPriceVolume ?? 0) + (fiveMinute.lowPriceVolume ?? 0);

  return {
    id: item.id,
    name: item.name,
    examine: item.examine,
    members: item.members,
    icon: item.icon,
    buyLimit: item.limit ?? null,
    highAlch: item.highalch ?? null,
    buyPrice,
    sellPrice,
    lastTradedAt: times.length > 0 ? Math.max(...times) : null,
    recentVolume: volume,
    fiveMinute: fiveMinute ?? null,
  };
}

export interface MarketSnapshot {
  mapping: readonly ItemMapping[];
  latest: Record<string, LatestPrice>;
  fiveMinute: Record<string, AveragePrice>;
  /** Ids that have a live price — the set worth showing on a price page. */
  tradeableIds: ReadonlySet<string>;
  /** Live nature rune price, for alch maths. Null if it somehow has no price. */
  natureRunePrice: number | null;
  /** When this snapshot was assembled, for the freshness note in the UI. */
  fetchedAt: number;
}

/**
 * Loads the three bulk feeds together.
 *
 * `Promise.all` rather than sequential awaits: they are independent, and three
 * serial round-trips is three times the latency for no benefit. This is three
 * requests total for the whole app per cache period — not three per visitor.
 */
export async function loadMarketSnapshot(): Promise<MarketSnapshot> {
  const [mapping, latest, fiveMinute] = await Promise.all([
    fetchItemMapping(),
    fetchLatestPrices(),
    fetchAveragePrices('5m'),
  ]);

  const tradeableIds = new Set<string>();
  for (const [id, price] of Object.entries(latest)) {
    if (price.high !== null || price.low !== null) tradeableIds.add(id);
  }

  const nature = latest[String(NATURE_RUNE_ITEM_ID)];

  return {
    mapping,
    latest,
    fiveMinute,
    tradeableIds,
    // Buying nature runes instantly is the honest cost of a cast, so use the
    // instant-buy side. Falling back to the sell side would understate the
    // cost and overstate every alch profit on the page.
    natureRunePrice: nature?.low ?? nature?.high ?? null,
    fetchedAt: Date.now(),
  };
}

/** Joins one item across the three feeds. Null when the id is not a real item. */
export function marketRowFor(snapshot: MarketSnapshot, itemId: number): MarketRow | null {
  const item = snapshot.mapping.find((entry) => entry.id === itemId);
  if (!item) return null;

  const key = String(itemId);
  return toMarketRow(item, snapshot.latest[key], snapshot.fiveMinute[key]);
}

/** Joins a list of items. Used for search results and the alch table. */
export function marketRowsFor(
  snapshot: MarketSnapshot,
  items: readonly ItemMapping[],
): MarketRow[] {
  return items.map((item) => {
    const key = String(item.id);
    return toMarketRow(item, snapshot.latest[key], snapshot.fiveMinute[key]);
  });
}

/**
 * The most actively traded items, for a page that needs a sensible default
 * list rather than an empty table.
 *
 * Sorted by recent volume because "what is moving right now" is the useful
 * default for both a price browser and a flipper — sorting by price would
 * just list the same handful of megarares every time.
 */
export function mostTradedRows(snapshot: MarketSnapshot, limit: number): MarketRow[] {
  const rows: MarketRow[] = [];

  for (const item of snapshot.mapping) {
    const key = String(item.id);
    const fiveMinute = snapshot.fiveMinute[key];
    if (!fiveMinute) continue;

    const row = toMarketRow(item, snapshot.latest[key], fiveMinute);
    if (row.buyPrice === null && row.sellPrice === null) continue;
    rows.push(row);
  }

  rows.sort((a, b) => (b.recentVolume ?? 0) - (a.recentVolume ?? 0));
  return rows.slice(0, limit);
}
