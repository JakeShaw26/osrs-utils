import { PriceTag } from '@/components/atoms/PriceTag';
import { StatBadge } from '@/components/atoms/StatBadge';
import { cn } from '@/lib/utils/cn';

/**
 * MOLECULE — a price plus its movement.
 *
 * Qualifies as a molecule: composes two atoms (PriceTag + StatBadge) to do one
 * job, holds no state, fetches nothing. It knows how a price change should look;
 * it knows nothing about where prices come from.
 *
 * Uses the `profit`/`loss` tokens rather than `success`/`danger` on purpose — a
 * falling item price is not an error state, and keeping them separate lets us
 * restyle market movement without touching form validation. (docs/theming.md)
 */

interface PriceChangeIndicatorProps {
  current: bigint | number;
  previous: bigint | number;
  className?: string;
}

export function PriceChangeIndicator({
  current,
  previous,
  className,
}: PriceChangeIndicatorProps) {
  const currentValue = Number(current);
  const previousValue = Number(previous);

  const delta = currentValue - previousValue;
  // Guard the divide: new items legitimately have no previous price.
  const percent = previousValue === 0 ? 0 : (delta / previousValue) * 100;
  const direction = delta === 0 ? 'flat' : delta > 0 ? 'up' : 'down';

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <PriceTag amount={current} />
      <StatBadge
        tone={
          direction === 'flat' ? 'neutral' : direction === 'up' ? 'success' : 'danger'
        }
        value={
          <span
            className={cn(
              direction === 'up' && 'text-profit',
              direction === 'down' && 'text-loss',
            )}
          >
            {direction === 'up' ? '▲' : direction === 'down' ? '▼' : '–'}{' '}
            {percent.toFixed(1)}%
          </span>
        }
      />
    </span>
  );
}
