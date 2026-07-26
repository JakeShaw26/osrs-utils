import { Countdown } from '@/components/atoms/utility/Countdown';
import { StatBadge } from '@/components/atoms/StatBadge';
import { cn } from '@/lib/utils/cn';
import type { RuleConfidence } from '@/lib/utility/resets';

/**
 * MOLECULE — one reset: what it is, how long until it fires, when that is.
 *
 * Two atoms doing one job, no state of its own, and every time value arrives
 * as an already-formatted string or a millisecond count. Formatting happens in
 * `lib/utility/resets.ts` so the timezone maths is testable without rendering
 * anything — which is the whole reason the DST handling can be pinned in a
 * node test.
 *
 * Anything below `documented` confidence is badged rather than presented with
 * the same authority as the rest. These are transcribed rules, not measured
 * ones (ADR-0019), and a tool that hides that is asking to be trusted more
 * than it deserves.
 */

interface ResetCardProps {
  label: string;
  description: string;
  /** Null until the client clock starts — see the Countdown atom. */
  msRemaining: number | null;
  /** Pre-formatted in the viewer's timezone. Null before the client renders. */
  localTime: string | null;
  /** The same instant in UTC. Also null pre-hydration — the *instant* depends
   *  on "now", so rendering it server-side would still be a guess. */
  utcTime: string | null;
  confidence: RuleConfidence;
  source: string;
  className?: string;
}

const confidenceTone = {
  documented: undefined,
  community: 'warning',
  unverified: 'warning',
} as const;

export function ResetCard({
  label,
  description,
  msRemaining,
  localTime,
  utcTime,
  confidence,
  source,
  className,
}: ResetCardProps) {
  const tone = confidenceTone[confidence];

  return (
    <article
      className={cn(
        'rounded-card border border-border bg-surface-raised p-4 shadow-card',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-content">{label}</h3>
        {tone ? <StatBadge tone={tone} value={confidence} /> : null}
      </div>

      <Countdown
        ms={msRemaining}
        label={`Time until ${label}`}
        className="mt-3 block text-3xl font-semibold"
      />

      <dl className="mt-3 grid gap-1 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-content-subtle">Your time</dt>
          {/* An em dash rather than an empty cell: "we have not worked this
              out yet" and "there is no answer" must not look identical. */}
          <dd className="tabular text-content-muted">{localTime ?? '—'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-content-subtle">Game time (UTC)</dt>
          <dd className="tabular text-content-muted">{utcTime ?? '—'}</dd>
        </div>
      </dl>

      <p className="mt-3 text-sm text-content-muted">{description}</p>
      <p className="mt-2 text-2xs text-content-subtle">{source}</p>
    </article>
  );
}
