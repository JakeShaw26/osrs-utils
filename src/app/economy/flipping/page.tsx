import type { Metadata } from 'next';
import Link from 'next/link';
import { ItemSearchForm } from '@/components/molecules/economy/ItemSearchForm';
import { FlippingCalculator } from '@/components/organisms/economy/FlippingCalculator';
import { CalculatorLayout } from '@/components/templates/CalculatorLayout';
import {
  GE_TAX_CAP_PER_ITEM,
  GE_TAX_FREE_BELOW,
  GE_TAX_RATE,
} from '@/lib/economy/ge-tax';
import { loadMarketSnapshot, marketRowFor } from '@/lib/economy/market';
import { searchItems } from '@/lib/economy/search';
import { formatGp } from '@/lib/utils/format-gp';

export const metadata: Metadata = {
  title: 'Flipping calculator',
  description:
    'Grand Exchange flipping margin after the 2% tax, with a liquidity warning based on live trade volume.',
};

/**
 * Flipping calculator.
 *
 * The page is a server component that fetches the bulk feeds and seeds one
 * client organism with real prices. `?item=<id>` prefills from the item page;
 * `?q=` searches. Both are plain URLs, so the calculator is usable with no
 * JavaScript up to the point where it starts recomputing as you type.
 */

/**
 * Live prices, never a build-time snapshot. Also keeps `next build` from
 * calling `getEnv()` in CI, which runs without secrets deliberately.
 */
export const dynamic = 'force-dynamic';

export default async function FlippingPage({
  searchParams,
}: {
  searchParams: Promise<{ item?: string | string[]; q?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawItem = Array.isArray(params.item) ? params.item[0] : params.item;
  const rawQuery = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = (rawQuery ?? '').trim();

  const snapshot = await loadMarketSnapshot();

  // A search resolves to its single best hit, so "?q=twisted bow" prefills
  // rather than making the user pick from a list and then retype the prices.
  const resolvedId = (() => {
    const parsed = Number(rawItem);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
    if (query === '') return null;
    const best = searchItems(snapshot.mapping, query, {
      limit: 1,
      tradeableIds: snapshot.tradeableIds,
    })[0];
    return best?.item.id ?? null;
  })();

  const row = resolvedId === null ? null : marketRowFor(snapshot, resolvedId);

  return (
    <CalculatorLayout
      title="Flipping calculator"
      description="Buy low, sell high, minus the Grand Exchange's cut — and a check that the item actually trades."
      notes={
        <ul className="list-disc space-y-1 pl-4">
          <li>
            <strong>GE tax: {(GE_TAX_RATE * 100).toFixed(0)}% of the sale price</strong>,
            capped at {formatGp(GE_TAX_CAP_PER_ITEM)} gp per item, rounded down. Items
            selling below {GE_TAX_FREE_BELOW} gp are untaxed because the rounded-down tax
            is zero. Introduced at 1% on 2021-12-09 and raised to 2% on 2025-05-29.
            Verified against the{' '}
            <a
              href="https://oldschool.runescape.wiki/w/Grand_Exchange"
              className="text-primary hover:underline"
              rel="noreferrer"
            >
              OSRS Wiki
            </a>{' '}
            on 2026-07-26.
          </li>
          <li>
            A short exempt list (bonds, starter tools, low-level food and teleports) pays
            no tax at all. Prefilling an exempt item shows this.
          </li>
          <li>
            Volume is the most recent 5-minute block extrapolated to an hour. It is the
            single most important number on this page: a large margin on an item trading a
            handful of times a day is a position you cannot exit.
          </li>
          <li>
            This calculator keeps nothing. There is no account and no server-side flip log
            — the app is public and read-only (ADR-0012).
          </li>
        </ul>
      }
    >
      <div className="space-y-6">
        <div>
          <ItemSearchForm
            action="/economy/flipping"
            defaultValue={query}
            label="Prefill from an item"
            placeholder="Prefill live prices — e.g. abyssal whip"
          />
          {row ? (
            <p className="mt-2 text-sm text-content-muted">
              Prefilled with live prices for{' '}
              <Link
                href={`/economy/items/${row.id}`}
                className="font-medium text-content hover:text-primary hover:underline"
              >
                {row.name}
              </Link>
              .
            </p>
          ) : query !== '' ? (
            <p className="mt-2 text-sm text-content-muted">
              No tradeable item matches “{query}”. Enter prices manually below.
            </p>
          ) : null}
        </div>

        <FlippingCalculator
          // Remounts the calculator when the prefilled item changes, so the
          // fields adopt the new prices instead of keeping the old ones as
          // stale local state.
          key={row?.id ?? 'manual'}
          initialItemName={row?.name}
          initialBuyPrice={row?.buyPrice ?? null}
          initialSellPrice={row?.sellPrice ?? null}
          initialQuantity={row?.buyLimit ?? 1}
          volume={row?.fiveMinute ?? null}
        />
      </div>
    </CalculatorLayout>
  );
}
