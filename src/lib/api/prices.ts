import 'server-only';
import { osrsFetch } from './osrs-fetch';

/**
 * OSRS Wiki Real-time Prices API.
 *
 * Verified behaviour is in docs/api-notes/osrs-wiki-prices.md — read it before
 * assuming a field's shape. The two things that shape every caller:
 *
 *  1. **`/timeseries` returns at most 365 points, whatever the timestep.** Range
 *     and granularity trade off directly, and ~1 year is the hard ceiling. There
 *     is no multi-year chart to build (ADR-0003).
 *  2. **Bulk beats per-item.** `/latest` returns every item in one response, and
 *     one shared cache entry then serves every visitor and every item. Fetching
 *     `?id=` per item creates a separate cache entry each time, so outbound
 *     traffic starts scaling with how many different items visitors look at —
 *     which is the open-proxy problem in miniature (ADR-0013).
 */

/** The API's own cap. Not a page size we chose — asking for more returns 365. */
export const MAX_TIMESERIES_POINTS = 365;

export type Timestep = '5m' | '1h' | '6h' | '24h';

/**
 * How far back each timestep reaches at the 365-point cap. Measured, not
 * calculated from the label — see the api-notes table.
 */
export const TIMESERIES_SPAN_DAYS: Record<Timestep, number> = {
  '5m': 2.3,
  '1h': 15.3,
  '6h': 91.3,
  '24h': 364,
};

/** Coarsest last, so `timestepForDays` can stop at the first that fits. */
const TIMESTEPS_BY_GRANULARITY: readonly Timestep[] = ['5m', '1h', '6h', '24h'];

export interface LatestPrice {
  /** Most recent instant-buy price. Null for items with no recent trade. */
  high: number | null;
  /** Unix seconds. Null whenever `high` is. */
  highTime: number | null;
  /** Most recent instant-sell price. */
  low: number | null;
  lowTime: number | null;
}

/** Keyed by item id **as a string** — it is a JSON object key, not a number. */
export type LatestPriceMap = Record<string, LatestPrice>;

export interface ItemMapping {
  id: number;
  name: string;
  examine: string;
  members: boolean;
  value: number;
  icon: string;
  /** Absent on untradeable or unalchable items — not zero, absent. */
  lowalch?: number;
  highalch?: number;
  /** GE buy limit per 4 hours. Absent when the item has none. */
  limit?: number;
}

export interface AveragePrice {
  avgHighPrice: number | null;
  highPriceVolume: number;
  avgLowPrice: number | null;
  lowPriceVolume: number;
}

export interface TimeseriesPoint {
  /** Unix seconds at the start of the block. */
  timestamp: number;
  avgHighPrice: number | null;
  avgLowPrice: number | null;
  highPriceVolume: number;
  lowPriceVolume: number;
}

/**
 * Every tradeable item's latest prices, in one request.
 *
 * Prefer this over `fetchLatestPrice` wherever a page shows more than one item:
 * the response is already in cache, so a table of fifty items costs zero extra
 * upstream requests.
 */
export async function fetchLatestPrices(): Promise<LatestPriceMap> {
  const body = await osrsFetch<{ data: LatestPriceMap }>('prices', '/latest');
  return body.data;
}

/**
 * One item's latest prices.
 *
 * Deliberately served from the bulk response rather than `/latest?id=`. That
 * looks wasteful per call and is cheaper in aggregate — one cache entry for all
 * items beats one per item, and it makes the upstream request rate independent
 * of what visitors search for.
 *
 * Returns null for an unknown id, or one with no recorded trades.
 */
export async function fetchLatestPrice(itemId: number): Promise<LatestPrice | null> {
  const prices = await fetchLatestPrices();
  return prices[String(itemId)] ?? null;
}

/**
 * Static item metadata: names, buy limits, alch values, icons.
 *
 * ~850 KB and near-immutable — it changes on weekly game updates, not on
 * trades. The default 60s prices TTL would re-download it every minute for no
 * benefit, so this overrides to a day.
 */
export async function fetchItemMapping(): Promise<ItemMapping[]> {
  return osrsFetch<ItemMapping[]>('prices', '/mapping', { revalidate: 86_400 });
}

/**
 * Volume-weighted averages over the most recent 5-minute or 1-hour block.
 *
 * `atTimestamp` (Unix **seconds**, aligned to the block) fetches a past block
 * instead. Historical blocks never change, so they get a long TTL — the live
 * block does not.
 */
export async function fetchAveragePrices(
  timestep: '5m' | '1h',
  atTimestamp?: number,
): Promise<Record<string, AveragePrice>> {
  const body = await osrsFetch<{ data: Record<string, AveragePrice> }>(
    'prices',
    `/${timestep}`,
    {
      searchParams: { timestamp: atTimestamp },
      revalidate: atTimestamp === undefined ? undefined : 86_400,
    },
  );
  return body.data;
}

/**
 * Price history for one item — up to 365 points ending now.
 *
 * This is the one endpoint that genuinely needs a per-item request, so it is
 * also the one most worth rate limiting when exposed to a public route: the
 * item id varies, so an attacker misses the cache on every request. Pair any
 * route wrapping this with `enforceRateLimit` (ADR-0013).
 */
export async function fetchTimeseries(
  itemId: number,
  timestep: Timestep,
): Promise<TimeseriesPoint[]> {
  const body = await osrsFetch<{ data: TimeseriesPoint[] }>('prices', '/timeseries', {
    searchParams: { id: itemId, timestep },
  });
  return body.data;
}

/**
 * The finest timestep that still covers `days`.
 *
 * Exists so a UI offers ranges ("last week") rather than timesteps, and so the
 * 365-point cap is enforced in one place instead of being rediscovered as "why
 * does my 30-day 1h chart stop halfway".
 *
 * Anything beyond 364 days clamps to `24h` — that is the ceiling of the data,
 * not a limit we imposed, so silently returning the longest available range
 * beats throwing at a caller who cannot do anything about it.
 */
export function timestepForDays(days: number): Timestep {
  return (
    TIMESTEPS_BY_GRANULARITY.find((step) => TIMESERIES_SPAN_DAYS[step] >= days) ?? '24h'
  );
}

/**
 * Mid price — the usual "what is this worth" figure.
 *
 * Null when either side is missing, rather than falling back to the side we do
 * have. A one-sided price is not a market value, and quietly substituting one
 * produces confidently wrong numbers on exactly the illiquid items where a
 * player is most likely to be misled.
 */
export function midPrice(price: LatestPrice | null | undefined): number | null {
  if (!price || price.high === null || price.low === null) return null;
  return Math.floor((price.high + price.low) / 2);
}

/**
 * Name → mapping entry, lowercased for case-insensitive lookup.
 *
 * Build once per request and reuse; the mapping is ~4,000 entries, so a linear
 * `find` per item turns a fifty-row table into 200,000 comparisons.
 *
 * Duplicate names exist (item variants). Last write wins, which matches the
 * API's own ordering rather than imposing one of our own.
 */
export function indexMappingByName(
  mapping: readonly ItemMapping[],
): Map<string, ItemMapping> {
  return new Map(mapping.map((item) => [item.name.toLowerCase(), item]));
}

export function indexMappingById(
  mapping: readonly ItemMapping[],
): Map<number, ItemMapping> {
  return new Map(mapping.map((item) => [item.id, item]));
}
