import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RangeSwitcher } from '@/components/molecules/economy/RangeSwitcher';
import { ItemOverview } from '@/components/organisms/economy/ItemOverview';
import { PriceHistoryChart } from '@/components/organisms/economy/PriceHistoryChart';
import { CalculatorLayout } from '@/components/templates/CalculatorLayout';
import { fetchTimeseries } from '@/lib/api/prices';
import { loadMarketSnapshot, marketRowFor } from '@/lib/economy/market';
import { resolveRange } from '@/lib/economy/price-ranges';

/**
 * One item: current market position plus price history.
 *
 * TWO THINGS WORTH KNOWING ABOUT THE UPSTREAM COST HERE.
 *
 * 1. Everything except the chart comes from the same three bulk feeds every
 *    other economy page uses, so it is free — the cache entry is already warm.
 *
 * 2. `/timeseries` is the one per-item endpoint in this feature, so it is the
 *    only place a visitor's choice can drive an outbound request. It is bounded
 *    three ways: the id is validated against `/mapping` first, so an invented
 *    id 404s without ever reaching the Wiki; `range` resolves to one of exactly
 *    four timesteps, so the parameter is never passed through unchecked; and
 *    the response is cached per (item, range) by `osrsFetch`, so the worst case
 *    is bounded by the real item catalogue rather than by request volume.
 *
 *    Deliberately NOT rate limited — but not for the reason first recorded
 *    here. This page reads `searchParams` and is rendered per request either
 *    way, so `enforceRateLimit()` would cost no render caching at all. The
 *    actual defence is the `fetchCache` line below: upstream volume is bounded
 *    by TTL rather than by request volume, which is line 2 of ADR-0013 doing
 *    its job. Revisit if this is ever deployed somewhere without an edge cache.
 *    Full reasoning in ADR-0014.
 */

/**
 * A dynamic segment with no `generateStaticParams` is already rendered on
 * demand, so nothing here is prerendered and `getEnv()` never runs during
 * `next build`. `fetchCache` is what preserves the shared data cache — the
 * per-(item, range) timeseries entries and the bulk feeds alike. Replaced
 * `dynamic = 'force-dynamic'`, which forced all of them to `no-store`.
 * See ADR-0014.
 */
export const fetchCache = 'default-cache';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string | string[] }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isInteger(itemId)) return { title: 'Item not found' };

  const snapshot = await loadMarketSnapshot();
  const row = marketRowFor(snapshot, itemId);

  return row
    ? { title: `${row.name} price`, description: row.examine }
    : { title: 'Item not found' };
}

export default async function ItemPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { range: rangeParam } = await searchParams;

  // Parse before fetching. A non-numeric id can never be a real item, so it
  // must not cost an upstream request to reject.
  const itemId = Number(id);
  if (!Number.isInteger(itemId) || itemId <= 0) notFound();

  const snapshot = await loadMarketSnapshot();
  const row = marketRowFor(snapshot, itemId);
  if (!row) notFound();

  const range = resolveRange(rangeParam);
  const history = await fetchTimeseries(itemId, range.timestep);

  return (
    <CalculatorLayout
      title={row.name}
      className="max-w-5xl"
      notes={
        <ul className="list-disc space-y-1 pl-4">
          <li>
            Price history caps at 365 points per range, which is why exactly four ranges
            exist and why there is no multi-year view — that data does not exist upstream
            (ADR-0003).
          </li>
          <li>
            Alch profit assumes 1,200 casts/hour and buying nature runes at the
            instant-buy price. Bank trips make the real rate lower.
          </li>
          <li>
            GE tax is 2% of the sale price, capped at 5m per item, rounded down. Verified
            against the OSRS Wiki on 2026-07-26.
          </li>
        </ul>
      }
    >
      <div className="space-y-8">
        <ItemOverview row={row} natureRunePrice={snapshot.natureRunePrice} />

        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-content">Price history</h2>
            <RangeSwitcher basePath={`/economy/items/${itemId}`} active={range.id} />
          </div>
          <PriceHistoryChart points={history} range={range} itemName={row.name} />
        </section>

        <p className="text-sm">
          <Link
            href={`/economy/flipping?item=${itemId}`}
            className="text-primary hover:underline"
          >
            Open this item in the flipping calculator →
          </Link>
        </p>
      </div>
    </CalculatorLayout>
  );
}
