import type { Metadata } from 'next';
import { ItemSearchForm } from '@/components/molecules/economy/ItemSearchForm';
import { ItemPriceTable } from '@/components/organisms/economy/ItemPriceTable';
import { CalculatorLayout } from '@/components/templates/CalculatorLayout';
import { loadMarketSnapshot, marketRowsFor, mostTradedRows } from '@/lib/economy/market';
import { searchItems } from '@/lib/economy/search';

export const metadata: Metadata = {
  title: 'GE price lookup',
  description:
    'Live Old School RuneScape Grand Exchange prices: buy, sell, margin after tax, buy limit, high alch value and trade volume.',
};

/**
 * Live GE price lookup.
 *
 * SERVER COMPONENT, and search happens through a plain GET form, so the entire
 * ~850 KB item mapping is searched here and never reaches a browser. The URL is
 * the state — `?q=twisted+bow` is shareable and cacheable.
 *
 * Upstream cost: three BULK requests (`/mapping`, `/latest`, `/5m`) shared by
 * every visitor and every query, regardless of how many people search or what
 * they search for. Nothing here scales with traffic, which is why this route
 * needs no rate limiting — see the note in `lib/economy/market.ts`.
 */

/**
 * Reading `searchParams` already makes this render per request, so the page is
 * never a build-time snapshot and `getEnv()` is never called during
 * `next build`. What it does NOT do is keep the data cache: under the default
 * `fetchCache: 'auto'`, fetches discovered after a request-time API go
 * uncached. `'default-cache'` honours the explicit `next: { revalidate }` that
 * `osrsFetch` sets, so the three bulk feeds are one shared upstream request per
 * TTL rather than one per visitor.
 *
 * This replaced `dynamic = 'force-dynamic'`, which is documented as equivalent
 * to `fetchCache = 'force-no-store'` and therefore overrode every TTL in
 * `osrsFetch`, re-fetching ~1MB from the Wiki on every page load. See ADR-0014.
 */
export const fetchCache = 'default-cache';

/** How many search hits to show. Beyond this the list stops being useful. */
const SEARCH_RESULT_LIMIT = 40;
/** Default list when there is no query: what is actually moving right now. */
const DEFAULT_ROW_LIMIT = 25;

export default async function PricesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawQuery = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = (rawQuery ?? '').trim();

  const snapshot = await loadMarketSnapshot();

  const rows =
    query === ''
      ? mostTradedRows(snapshot, DEFAULT_ROW_LIMIT)
      : marketRowsFor(
          snapshot,
          searchItems(snapshot.mapping, query, {
            limit: SEARCH_RESULT_LIMIT,
            tradeableIds: snapshot.tradeableIds,
          }).map((result) => result.item),
        );

  return (
    <CalculatorLayout
      title="GE price lookup"
      description="Live Grand Exchange prices for every tradeable item, with the margin already net of tax."
      className="max-w-6xl"
      notes={
        <ul className="list-disc space-y-1 pl-4">
          <li>
            Prices are the OSRS Wiki real-time feed and update roughly every minute.
            &ldquo;Buy&rdquo; is the instant-buy price you pay; &ldquo;Sell&rdquo; is what
            you receive selling instantly.
          </li>
          <li>
            Margin is <strong>after</strong> the 2% Grand Exchange tax, capped at 5m per
            item. Tax rates verified against the OSRS Wiki on 2026-07-26.
          </li>
          <li>
            Volume comes from the most recent 5-minute block, extrapolated to an hourly
            rate. A single block is noisy — treat it as a signal, not a measurement.
          </li>
          <li>Buy limits are per 4 hours, per account.</li>
        </ul>
      }
    >
      <div className="space-y-6">
        <ItemSearchForm action="/economy/prices" defaultValue={query} />

        <div>
          <h2 className="mb-3 text-sm font-medium text-content-muted">
            {query === '' ? 'Most actively traded right now' : `Results for “${query}”`}
          </h2>
          <ItemPriceTable
            rows={rows}
            emptyMessage={
              query === ''
                ? 'No market data available right now.'
                : `No tradeable item matches “${query}”.`
            }
          />
        </div>
      </div>
    </CalculatorLayout>
  );
}
