import { StatTile } from '@/components/atoms/economy/StatTile';
import { StatBadge } from '@/components/atoms/StatBadge';
import { LiquidityWarning } from '@/components/molecules/economy/LiquidityWarning';
import { calculateAlchProfit } from '@/lib/economy/alch';
import { assessLiquidity, calculateFlip } from '@/lib/economy/flipping';
import { GE_TAX_CAP_PER_ITEM, GE_TAX_RATE } from '@/lib/economy/ge-tax';
import type { MarketRow } from '@/lib/economy/market';
import { formatGp } from '@/lib/utils/format-gp';

/**
 * ORGANISM — everything known about one item's market position.
 *
 * A complete, meaningful page section: prices, the margin after tax, the buy
 * limit, the alch figure, and the liquidity that determines whether any of it
 * is achievable. Server component — it computes from props and renders.
 *
 * Note that every derived figure comes from `lib/economy/`. This file contains
 * no arithmetic beyond choosing what to show.
 */

interface ItemOverviewProps {
  row: MarketRow;
  /** Live nature rune price, for the alch tile. Null when unavailable. */
  natureRunePrice: number | null;
}

function relativeAge(unixSeconds: number | null): string {
  if (unixSeconds === null) return 'never traded';

  const minutes = Math.max(0, Math.round((Date.now() / 1000 - unixSeconds) / 60));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;

  return `${Math.round(hours / 24)} days ago`;
}

export function ItemOverview({ row, natureRunePrice }: ItemOverviewProps) {
  const priced = row.buyPrice !== null && row.sellPrice !== null;

  const flip = priced
    ? calculateFlip({
        buyPrice: row.buyPrice ?? 0,
        sellPrice: row.sellPrice ?? 0,
        itemName: row.name,
      })
    : null;

  const alch = calculateAlchProfit({
    highAlchValue: row.highAlch,
    buyPrice: row.buyPrice,
    natureRunePrice,
    buyLimit: row.buyLimit,
  });

  const liquidity = assessLiquidity(row.fiveMinute);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold text-content">{row.name}</h2>
          {row.members ? <StatBadge tone="members" value="Members" /> : null}
          {flip?.taxExempt ? <StatBadge tone="info" value="Tax exempt" /> : null}
        </div>
        <p className="mt-1 text-sm text-content-muted">{row.examine}</p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Buy price"
          value={row.buyPrice === null ? '—' : `${formatGp(row.buyPrice)} gp`}
          hint={`Instant-buy · ${relativeAge(row.lastTradedAt)}`}
        />
        <StatTile
          label="Sell price"
          value={row.sellPrice === null ? '—' : `${formatGp(row.sellPrice)} gp`}
          hint="Instant-sell"
        />
        <StatTile
          label="Margin after tax"
          value={flip === null ? '—' : `${formatGp(flip.netMarginPerItem)} gp`}
          tone={flip === null ? 'neutral' : flip.isLoss ? 'loss' : 'profit'}
          hint={
            flip === null
              ? 'Needs prices on both sides'
              : flip.taxExempt
                ? 'No GE tax on this item'
                : `after ${formatGp(flip.taxPerItem)} gp tax${
                    flip.taxCapped ? ` (capped at ${formatGp(GE_TAX_CAP_PER_ITEM)})` : ''
                  }`
          }
        />
        <StatTile
          label="Buy limit"
          value={row.buyLimit === null ? 'None' : row.buyLimit.toLocaleString('en-GB')}
          hint="per 4 hours"
        />
      </dl>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="High alch value"
          value={row.highAlch === null ? 'Unalchable' : `${formatGp(row.highAlch)} gp`}
        />
        <StatTile
          label="Alch profit / cast"
          value={
            alch.unalchable || row.buyPrice === null
              ? '—'
              : `${formatGp(alch.profitPerCast)} gp`
          }
          tone={alch.unalchable ? 'neutral' : alch.isLoss ? 'loss' : 'profit'}
          hint={
            natureRunePrice === null
              ? 'Nature rune price unavailable'
              : `after ${formatGp(natureRunePrice)} gp nature rune`
          }
        />
        <StatTile
          label="Alch profit / hour"
          value={
            alch.unalchable || row.buyPrice === null
              ? '—'
              : `${formatGp(alch.profitPerHour)} gp`
          }
          tone={alch.unalchable ? 'neutral' : alch.isLoss ? 'loss' : 'profit'}
          hint={
            alch.limitedByBuyLimit
              ? `capped by the buy limit at ${alch.sustainableCastsPerHour.toLocaleString('en-GB')} casts/hr`
              : `${alch.sustainableCastsPerHour.toLocaleString('en-GB')} casts/hr`
          }
        />
        <StatTile
          label="GE tax"
          value={
            flip?.taxExempt ? 'Exempt' : `${(GE_TAX_RATE * 100).toFixed(0)}% of sale`
          }
          hint={
            flip?.taxExempt
              ? 'On the exempt list'
              : `capped at ${formatGp(GE_TAX_CAP_PER_ITEM)} gp/item`
          }
        />
      </dl>

      <div className="rounded-card border border-border bg-surface-sunken p-4">
        <h3 className="mb-2 text-2xs font-semibold tracking-wide text-content-subtle uppercase">
          Liquidity
        </h3>
        <LiquidityWarning assessment={liquidity} />
      </div>
    </div>
  );
}
