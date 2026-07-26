import { formatCountdown } from '@/lib/utility/duration';
import { cn } from '@/lib/utils/cn';

/**
 * ATOM — a formatted countdown.
 *
 * Renders a number it is handed. It owns no clock, no interval and no effect,
 * which is what keeps it a server-renderable atom and keeps the ticking
 * testable as pure arithmetic in `lib/utility/duration.ts`.
 *
 * **`ms === null` is the load-bearing state.** A live clock must never be
 * server-rendered with a real value: the server computes one instant, the
 * browser hydrates a few hundred milliseconds later and computes another, and
 * React throws a hydration mismatch on the difference. The owning organism
 * passes null until its first effect runs, so both renders agree on a stable
 * placeholder and the clock starts client-side.
 *
 * `.tabular` is not decoration here. A countdown in a proportional font
 * re-measures every digit every second, so the whole row twitches sideways
 * once per second — the single most visible thing that class prevents.
 */

/** Same character count as a live `HH:MM:SS`, so nothing reflows on first tick. */
export const COUNTDOWN_PLACEHOLDER = '--:--:--';

interface CountdownProps {
  /** Milliseconds remaining, or null before the client clock has started. */
  ms: number | null;
  /** What is being counted down to — becomes the accessible name. */
  label: string;
  className?: string;
}

export function Countdown({ ms, label, className }: CountdownProps) {
  const display = ms === null ? COUNTDOWN_PLACEHOLDER : formatCountdown(ms);

  return (
    <span
      role="timer"
      // role="timer" carries an implicit aria-live of "off"; stating it makes
      // the intent explicit. A value that changes once a second must not be
      // announced once a second — that renders the page unusable with a screen
      // reader, and the countdown is not urgent information.
      aria-live="off"
      aria-label={`${label}: ${ms === null ? 'calculating' : display}`}
      className={cn('tabular text-content', className)}
    >
      {display}
    </span>
  );
}
