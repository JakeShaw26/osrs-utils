import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableEmptyRow,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/components/atoms/Table';
import { LiquidityWarning } from '@/components/molecules/economy/LiquidityWarning';
import { assessLiquidity, calculateFlip } from '@/lib/economy/flipping';
import type { MarketRow } from '@/lib/economy/market';
import { formatGp } from '@/lib/utils/format-gp';

/**
 * ORGANISM — a price list.
 *
 * Server component: it renders links and numbers, no interactivity. Receives
 * rows as props and fetches nothing, per the layering rules.
 *
 * The margin column is net of GE tax, not gross, and every row carries a
 * liquidity badge. Both are deliberate — a table of gross margins sorted
 * descending is a list of traps, because the biggest gross margins cluster on
 * the items nobody trades. (PRD §3.1)
 */

interface ItemPriceTableProps {
  rows: readonly MarketRow[];
  /** Shown when `rows` is empty — states the reason rather than implying a bug. */
  emptyMessage: string;
}

export function ItemPriceTable({ rows, emptyMessage }: ItemPriceTableProps) {
  return (
    <Table>
      <caption className="sr-only">
        Live Grand Exchange prices, with margin after tax and recent trade volume.
      </caption>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Item</TableHeaderCell>
          <TableHeaderCell numeric>Buy</TableHeaderCell>
          <TableHeaderCell numeric>Sell</TableHeaderCell>
          <TableHeaderCell numeric>Margin</TableHeaderCell>
          <TableHeaderCell numeric>Limit</TableHeaderCell>
          <TableHeaderCell numeric>High alch</TableHeaderCell>
          <TableHeaderCell>Volume</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.length === 0 ? (
          <TableEmptyRow colSpan={7}>{emptyMessage}</TableEmptyRow>
        ) : (
          rows.map((row) => {
            const priced = row.buyPrice !== null && row.sellPrice !== null;
            const flip = priced
              ? calculateFlip({
                  buyPrice: row.buyPrice ?? 0,
                  sellPrice: row.sellPrice ?? 0,
                  itemName: row.name,
                })
              : null;

            return (
              <TableRow key={row.id}>
                <TableCell>
                  <Link
                    href={`/economy/items/${row.id}`}
                    className="font-medium text-content hover:text-primary hover:underline"
                  >
                    {row.name}
                  </Link>
                </TableCell>
                <TableCell numeric>
                  {row.buyPrice === null ? '—' : formatGp(row.buyPrice)}
                </TableCell>
                <TableCell numeric>
                  {row.sellPrice === null ? '—' : formatGp(row.sellPrice)}
                </TableCell>
                <TableCell
                  numeric
                  className={
                    flip === null ? undefined : flip.isLoss ? 'text-loss' : 'text-profit'
                  }
                >
                  {flip === null ? '—' : formatGp(flip.netMarginPerItem)}
                </TableCell>
                <TableCell numeric>
                  {row.buyLimit === null ? '—' : row.buyLimit.toLocaleString('en-GB')}
                </TableCell>
                <TableCell numeric>
                  {row.highAlch === null ? '—' : formatGp(row.highAlch)}
                </TableCell>
                <TableCell>
                  <LiquidityWarning
                    assessment={assessLiquidity(row.fiveMinute)}
                    compact
                  />
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
