import { cn } from '@/lib/utils/cn';
import { formatGp, formatGpExact } from '@/lib/utils/format-gp';

/**
 * ATOM — renders a GP amount.
 *
 * The formatting logic itself lives in lib/utils/format-gp.ts, not here. The
 * atom only decides how it *looks*; the maths is testable on its own. That
 * split is the convention for every component in this repo. (components/README.md)
 *
 * `tabular` gives fixed-width digits so columns of prices line up and values
 * don't jitter as they refresh.
 */

interface PriceTagProps {
  amount: bigint | number;
  /** Show the unabbreviated value on hover. Off inside dense tables. */
  showExactOnHover?: boolean;
  className?: string;
}

export function PriceTag({ amount, showExactOnHover = true, className }: PriceTagProps) {
  return (
    <span
      className={cn('tabular text-content', className)}
      title={showExactOnHover ? `${formatGpExact(amount)} gp` : undefined}
    >
      {formatGp(amount)}
    </span>
  );
}
