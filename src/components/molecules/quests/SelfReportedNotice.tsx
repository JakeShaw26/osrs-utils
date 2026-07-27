import { StatBadge } from '@/components/atoms/StatBadge';

/**
 * MOLECULE — the standing caveat on anything a member told us.
 *
 * This exists as a component rather than as prose repeated three times because
 * it is the one honesty guarantee the whole quest feature rests on. Quest and
 * diary completion are absent from the Jagex hiscores, so every completion
 * figure on screen is an assertion by the member, not a fact we verified. A
 * page that shows "45 quest points" without saying where that number came from
 * is claiming knowledge it does not have.
 *
 * Keeping it in one place also means the wording can be improved once rather
 * than drifting between the planner, the tracker and the diary checker.
 */

interface SelfReportedNoticeProps {
  /** What the member declared, e.g. "quest completions". */
  subject: string;
  children?: React.ReactNode;
}

export function SelfReportedNotice({ subject, children }: SelfReportedNoticeProps) {
  return (
    <div className="flex flex-col gap-2 rounded-card border border-border bg-surface-sunken p-3 sm:flex-row sm:items-start sm:gap-3">
      <StatBadge value="Self-reported" tone="warning" />
      <p className="text-sm text-content-muted">
        Your {subject} cannot be read from the hiscores — Jagex does not publish them.
        Everything here is what <strong className="font-medium text-content">you</strong>{' '}
        told us, stored only in this browser. {children}
      </p>
    </div>
  );
}
