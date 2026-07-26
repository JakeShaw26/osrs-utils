import Link from 'next/link';
import { PRICE_RANGES, type RangeId } from '@/lib/economy/price-ranges';
import { cn } from '@/lib/utils/cn';

/**
 * MOLECULE — the four price-history ranges.
 *
 * Links, not buttons, so this needs no JavaScript and each range is a real URL
 * the server renders and the CDN can cache. A client-side toggle would make
 * every range change an uncacheable per-visitor fetch of `/timeseries`, which
 * is the one upstream endpoint in this feature that is NOT bulk — exactly the
 * traffic pattern ADR-0013 exists to prevent.
 *
 * Four options and only ever four: `/timeseries` caps at 365 points, so the
 * ranges are the timesteps. There is no "all time" to add later (ADR-0003).
 */

interface RangeSwitcherProps {
  /** Route the links point at, without a query string. */
  basePath: string;
  active: RangeId;
  /** Preserved across range changes so other params survive. */
  extraParams?: Record<string, string>;
}

export function RangeSwitcher({ basePath, active, extraParams }: RangeSwitcherProps) {
  return (
    <nav aria-label="Price history range">
      <ul className="flex flex-wrap gap-1">
        {PRICE_RANGES.map((range) => {
          const isActive = range.id === active;
          const params = new URLSearchParams({ ...extraParams, range: range.id });

          return (
            <li key={range.id}>
              <Link
                href={`${basePath}?${params.toString()}`}
                // The accessible way to say "this one is the current view".
                // Styling alone leaves a screen-reader user unable to tell.
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center rounded-control px-3 py-1.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-content'
                    : 'bg-surface-sunken text-content-muted hover:bg-surface-hover hover:text-content',
                )}
              >
                {range.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
