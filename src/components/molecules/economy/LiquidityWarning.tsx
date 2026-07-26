import { StatBadge, type StatTone } from '@/components/atoms/StatBadge';
import type { LiquidityAssessment, LiquidityLevel } from '@/lib/economy/flipping';

/**
 * MOLECULE — the volume warning that sits beside every margin in this feature.
 *
 * This is the component the PRD singles out: "showing margin without volume is
 * the most common flaw in flipping tools". It is a molecule rather than an
 * inline `<span>` precisely so it is hard to omit — a margin figure with no
 * liquidity context is the defect, and having a named component for the context
 * makes its absence visible in review.
 *
 * The assessment itself is computed in `lib/economy/flipping.ts`. This only
 * chooses how it looks.
 */

const TONES: Record<LiquidityLevel, StatTone> = {
  unknown: 'neutral',
  illiquid: 'danger',
  thin: 'warning',
  active: 'success',
};

const LABELS: Record<LiquidityLevel, string> = {
  unknown: 'No volume data',
  illiquid: 'Illiquid',
  thin: 'Thin',
  active: 'Active',
};

interface LiquidityWarningProps {
  assessment: LiquidityAssessment;
  /** Hides the explanatory sentence, for use inside a dense table cell. */
  compact?: boolean;
}

export function LiquidityWarning({ assessment, compact = false }: LiquidityWarningProps) {
  const badge = (
    <StatBadge tone={TONES[assessment.level]} value={LABELS[assessment.level]} />
  );

  if (compact) {
    // The reason still reaches a mouse user and a screen reader via the title,
    // so the compact form loses the layout, not the information.
    return <span title={assessment.reason}>{badge}</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {badge}
      <p className="text-sm text-content-muted">{assessment.reason}</p>
      {assessment.hoursToFill !== null && assessment.hoursToFill > 1 ? (
        <p className="text-sm text-warning">
          At this volume your order alone is roughly{' '}
          <span className="tabular">{assessment.hoursToFill.toFixed(1)}</span> hours of
          the entire market.
        </p>
      ) : null}
    </div>
  );
}
