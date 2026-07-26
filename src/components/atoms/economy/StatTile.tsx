import { cn } from '@/lib/utils/cn';

/**
 * ATOM — one labelled headline figure.
 *
 * Distinct from `StatBadge`, which is an inline pill for a secondary value.
 * This is the block form used where the number IS the answer — margin, profit
 * per hour, buy limit. Both exist because a pill scaled up reads as a button,
 * and a tile shrunk down reads as a badge.
 *
 * Renders no other component, so it stays an atom. It takes formatted `value`
 * text rather than a number: GP formatting lives in `lib/utils/format-gp.ts`
 * and the profit/loss decision lives in `lib/economy/`, so this file has no
 * domain logic to get wrong.
 */

export type StatTileTone = 'neutral' | 'profit' | 'loss' | 'warning';

const toneClasses: Record<StatTileTone, string> = {
  neutral: 'text-content',
  // Market movement, not validation state — docs/theming.md.
  profit: 'text-profit',
  loss: 'text-loss',
  warning: 'text-warning',
};

interface StatTileProps {
  label: string;
  value: React.ReactNode;
  /** Secondary line: an assumption, a unit, or where the number came from. */
  hint?: React.ReactNode;
  tone?: StatTileTone;
  className?: string;
}

export function StatTile({
  label,
  value,
  hint,
  tone = 'neutral',
  className,
}: StatTileProps) {
  return (
    <div
      className={cn(
        'rounded-card border border-border bg-surface-sunken px-3 py-2.5',
        className,
      )}
    >
      <dt className="text-2xs font-medium tracking-wide text-content-subtle uppercase">
        {label}
      </dt>
      <dd className={cn('tabular mt-1 text-lg font-semibold', toneClasses[tone])}>
        {value}
      </dd>
      {hint ? <p className="mt-0.5 text-xs text-content-muted">{hint}</p> : null}
    </div>
  );
}
