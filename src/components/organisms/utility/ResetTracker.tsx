'use client';

import { ResetCard } from '@/components/molecules/utility/ResetCard';
import { useClock } from '@/lib/utility/use-clock';
import {
  RESET_RULES,
  RESET_RULES_VERSION,
  formatResetLocal,
  formatResetUtc,
  formatUtcOffset,
  localOffsetMinutes,
  resetStatuses,
  type ResetRule,
} from '@/lib/utility/resets';

/**
 * ORGANISM — the reset countdown board.
 *
 * "use client" lives here, on the smallest thing that genuinely needs it: the
 * route stays a server component and only this subtree ships to the browser.
 *
 * ─── THE HYDRATION RULE ─────────────────────────────────────────────────────
 *
 * `now` starts as **null**, not `new Date()`. Seeding it with the current time
 * would make the server render one instant and the browser render another
 * milliseconds later, and React treats that text difference as a hydration
 * mismatch. Local-time strings are worse still: the server's timezone is not
 * the viewer's, so `formatResetLocal` on the server is a guaranteed mismatch
 * and, on a page whose entire subject is timezones, an embarrassing one.
 *
 * So *nothing* time-derived is rendered on the server. `useClock()` returns
 * null there and the card list renders from the rule set with placeholders in
 * every time slot, filling in on the client. That also keeps the server HTML
 * genuinely useful: the reset names, descriptions and sources are present and
 * indexable, and only the numbers are deferred.
 */

interface ResetTrackerProps {
  rules?: readonly ResetRule[];
}

export function ResetTracker({ rules = RESET_RULES }: ResetTrackerProps) {
  const now = useClock();

  // Soonest first once the clock is running; declaration order before that, so
  // the server render and the first client render agree on the DOM order.
  const ordered =
    now === null
      ? rules.map((rule) => ({ rule, nextAt: null, msRemaining: null }))
      : resetStatuses(now, rules);

  const offset = now === null ? null : localOffsetMinutes(now);

  return (
    <div>
      <p className="mb-4 text-sm text-content-muted">
        Every reset below fires at a fixed time in <strong>UTC</strong>, which is what the
        game runs on. The “your time” row converts that instant to whatever your device
        thinks the time is — so in the UK it moves by an hour when BST starts and ends,
        while the countdown itself does not change.{' '}
        {offset === null ? null : (
          <>
            Your clock is currently{' '}
            <strong className="tabular">{formatUtcOffset(offset)}</strong>.
          </>
        )}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {ordered.map(({ rule, nextAt, msRemaining }) => (
          <ResetCard
            key={rule.id}
            label={rule.label}
            description={rule.description}
            msRemaining={msRemaining}
            localTime={nextAt === null ? null : formatResetLocal(nextAt)}
            utcTime={nextAt === null ? null : formatResetUtc(nextAt)}
            confidence={rule.confidence}
            source={rule.source}
          />
        ))}
      </div>

      <p className="mt-4 text-2xs text-content-subtle">
        Reset rule set {RESET_RULES_VERSION}
      </p>
    </div>
  );
}
