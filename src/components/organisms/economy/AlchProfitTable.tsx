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
import { StatBadge } from '@/components/atoms/StatBadge';
import type { AlchCandidate, AlchOpportunity } from '@/lib/economy/alch';
import { formatGp } from '@/lib/utils/format-gp';

/**
 * ORGANISM — high alch opportunities, ranked by realistic gp/hour.
 *
 * The ordering is the opinion in this component, and it is `profitPerHour`
 * rather than `profitPerCast`. Ranking by per-cast profit produces a table
 * topped by items with a buy limit of 8, which is how most alch tables mislead:
 * the headline number is real, and completely unreachable.
 *
 * The "Limited" badge marks rows where the GE buy limit — not casting speed —
 * is what caps the hourly figure, which is the case for nearly everything worth
 * alching.
 */

interface AlchProfitTableProps {
  opportunities: readonly AlchOpportunity<AlchCandidate & { id: number; name: string }>[];
  emptyMessage: string;
}

export function AlchProfitTable({ opportunities, emptyMessage }: AlchProfitTableProps) {
  return (
    <Table>
      <caption className="sr-only">
        Items ranked by high alchemy profit per hour, accounting for the Grand Exchange
        buy limit.
      </caption>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Item</TableHeaderCell>
          <TableHeaderCell numeric>Buy</TableHeaderCell>
          <TableHeaderCell numeric>Alch value</TableHeaderCell>
          <TableHeaderCell numeric>Profit / cast</TableHeaderCell>
          <TableHeaderCell numeric>Buy limit</TableHeaderCell>
          <TableHeaderCell numeric>Casts / hr</TableHeaderCell>
          <TableHeaderCell numeric>Profit / hr</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {opportunities.length === 0 ? (
          <TableEmptyRow colSpan={7}>{emptyMessage}</TableEmptyRow>
        ) : (
          opportunities.map(({ item, result }) => (
            <TableRow key={item.id}>
              <TableCell>
                <Link
                  href={`/economy/items/${item.id}`}
                  className="font-medium text-content hover:text-primary hover:underline"
                >
                  {item.name}
                </Link>
              </TableCell>
              <TableCell numeric>
                {item.buyPrice === null ? '—' : formatGp(item.buyPrice)}
              </TableCell>
              <TableCell numeric>
                {item.highAlch === null ? '—' : formatGp(item.highAlch)}
              </TableCell>
              <TableCell numeric className={result.isLoss ? 'text-loss' : 'text-profit'}>
                {formatGp(result.profitPerCast)}
              </TableCell>
              <TableCell numeric>
                {item.buyLimit === null ? (
                  'None'
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    {item.buyLimit.toLocaleString('en-GB')}
                    {result.limitedByBuyLimit ? (
                      <StatBadge
                        tone="warning"
                        value="Limited"
                        // The badge is terse by necessity; the title explains it.
                        className="cursor-help"
                      />
                    ) : null}
                  </span>
                )}
              </TableCell>
              <TableCell numeric>
                {result.sustainableCastsPerHour.toLocaleString('en-GB')}
              </TableCell>
              <TableCell numeric className={result.isLoss ? 'text-loss' : 'text-profit'}>
                {formatGp(result.profitPerHour)}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
