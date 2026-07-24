import { cn } from '@/lib/utils/cn';

/**
 * ATOM — a single labelled value pill.
 *
 * Qualifies as an atom: no data fetching, no domain logic, no child components,
 * and meaningless to split further. Used by combat, skilling and clan features
 * alike, which is exactly why it lives here rather than beside one feature.
 *
 * Note every colour is a semantic token. There is no hex value and no raw
 * palette name in this file — that is the rule that makes light/dark work
 * without a single conditional. (docs/theming.md)
 */

export type StatTone = 'neutral' | 'success' | 'danger' | 'warning' | 'info' | 'members';

const toneClasses: Record<StatTone, string> = {
  neutral: 'bg-surface-sunken text-content-muted',
  success: 'bg-success/10 text-success',
  danger: 'bg-danger/10 text-danger',
  warning: 'bg-warning/10 text-warning',
  info: 'bg-info/10 text-info',
  members: 'bg-members/10 text-members',
};

interface StatBadgeProps {
  label?: string;
  value: React.ReactNode;
  tone?: StatTone;
  className?: string;
}

export function StatBadge({ label, value, tone = 'neutral', className }: StatBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-control px-2 py-1 text-xs font-medium',
        toneClasses[tone],
        className,
      )}
    >
      {label ? <span className="text-content-subtle">{label}</span> : null}
      <span className="tabular">{value}</span>
    </span>
  );
}
