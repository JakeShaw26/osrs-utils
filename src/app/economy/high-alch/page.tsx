import type { Metadata } from 'next';
import Link from 'next/link';
import { StatTile } from '@/components/atoms/economy/StatTile';
import { AlchProfitTable } from '@/components/organisms/economy/AlchProfitTable';
import { CalculatorLayout } from '@/components/templates/CalculatorLayout';
import {
  ALCH_CASTS_PER_HOUR,
  MIN_ALCH_VOLUME_PER_5M,
  NATURE_RUNE_ITEM_ID,
  rankAlchOpportunities,
} from '@/lib/economy/alch';
import { loadMarketSnapshot, marketRowsFor } from '@/lib/economy/market';
import { formatGp } from '@/lib/utils/format-gp';

export const metadata: Metadata = {
  title: 'High alch profit',
  description:
    'Old School RuneScape items ranked by High Level Alchemy profit per hour, accounting for the Grand Exchange buy limit.',
};

/**
 * High alch profit, ranked by realistic gp/hour.
 *
 * Everything comes from the three bulk feeds — `highalch` and `limit` from
 * `/mapping`, item and nature rune prices from `/latest`, volume from `/5m`.
 * The whole page is one shared cache entry's worth of upstream traffic no
 * matter how many people load it.
 */

/**
 * Never prerender this at build time.
 *
 * Two reasons, and the second is the one that bites. First, prices change every
 * minute, so a build-time snapshot is stale before the deploy finishes. Second,
 * prerendering runs `getEnv()` during `next build`, where secrets legitimately
 * do not exist — CI builds without them on purpose, and this page has no
 * dynamic params to opt itself out. Without this line the build fails.
 *
 * This does NOT weaken the upstream protection: `osrsFetch`'s data cache is
 * independent of the render mode, so the three bulk feeds are still fetched
 * once per TTL and shared by every request.
 */
export const dynamic = 'force-dynamic';

const RESULT_LIMIT = 40;

export default async function HighAlchPage() {
  const snapshot = await loadMarketSnapshot();

  const candidates = marketRowsFor(snapshot, snapshot.mapping).filter(
    (row) => row.highAlch !== null && row.buyPrice !== null,
  );

  const opportunities = rankAlchOpportunities(
    candidates,
    snapshot.natureRunePrice,
    RESULT_LIMIT,
  );

  return (
    <CalculatorLayout
      title="High alch profit"
      description="High Level Alchemy value minus the buy price and a nature rune — ranked by what you can actually earn in an hour."
      className="max-w-6xl"
      notes={
        <ul className="list-disc space-y-1 pl-4">
          <li>
            <strong>Ranked by profit per hour, not per cast.</strong> An item worth 3,000
            gp a cast with a buy limit of 8 earns less in an hour than a 60 gp item you
            can buy 13,000 of. The buy limit is usually the binding constraint, and
            sorting by per-cast profit is how most alch tables mislead.
          </li>
          <li>
            Assumes{' '}
            <strong>{ALCH_CASTS_PER_HOUR.toLocaleString('en-GB')} casts/hour</strong> —
            High Level Alchemy is a 5-tick (3 second) spell, so this is the uninterrupted
            ceiling. Bank trips make the real figure lower. It is an assumption, not a
            measurement.
          </li>
          <li>
            Items trading fewer than {MIN_ALCH_VOLUME_PER_5M} times per 5-minute block are
            excluded. Alching needs steady resupply, and a ranked table with no volume
            floor is topped by items nobody sells.
          </li>
          <li>
            Nature rune cost is live, at the instant-buy price — the honest cost of a
            cast.
          </li>
        </ul>
      }
    >
      <div className="space-y-6">
        <dl className="grid gap-3 sm:grid-cols-3">
          <StatTile
            label="Nature rune"
            value={
              snapshot.natureRunePrice === null
                ? '—'
                : `${formatGp(snapshot.natureRunePrice)} gp`
            }
            hint={
              <Link
                href={`/economy/items/${NATURE_RUNE_ITEM_ID}`}
                className="text-primary hover:underline"
              >
                Live instant-buy price
              </Link>
            }
          />
          <StatTile
            label="Casts per hour"
            value={ALCH_CASTS_PER_HOUR.toLocaleString('en-GB')}
            hint="Assumed ceiling, uninterrupted"
          />
          <StatTile
            label="Profitable items"
            value={opportunities.length.toLocaleString('en-GB')}
            hint={`Top ${RESULT_LIMIT} shown`}
          />
        </dl>

        <AlchProfitTable
          opportunities={opportunities}
          emptyMessage="No item is currently profitable to high alch at live prices."
        />
      </div>
    </CalculatorLayout>
  );
}
