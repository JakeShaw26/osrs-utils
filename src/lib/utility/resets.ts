import { MS_PER_DAY } from './duration';

/**
 * Countdowns to the game's recurring resets.
 *
 * ─── THE ONE THING TO UNDERSTAND ────────────────────────────────────────────
 *
 * **The game resets on UTC. Users read the clock in local time. Never mix
 * them.** Every function here does its arithmetic with `Date.UTC` and the
 * `getUTC*` accessors; local time appears only at the very last step, in
 * `formatResetLocal`, which hands the instant to `Intl.DateTimeFormat`.
 *
 * The bug this exists to prevent is specific and classic. The obvious
 * implementation of "next daily reset" is:
 *
 *     const next = new Date(now);
 *     next.setHours(24, 0, 0, 0);            // ✗ LOCAL midnight
 *
 * For a user in London that is correct for roughly half the year and exactly
 * one hour wrong for the other half, because the UK observes BST (UTC+1) from
 * late March to late October. It is wrong by a whole working day for anyone in
 * Australia. Worse, it is wrong in a way that looks right in development if the
 * developer happens to be testing in winter.
 *
 * Two further traps that the UTC-first approach removes for free:
 *
 *  - **A local day is not always 24 hours.** On the Sunday the clocks go
 *    forward, local midnight-to-midnight is 23 hours; in autumn it is 25. Any
 *    countdown built by adding 24h to a *local* midnight drifts on those days.
 *    In UTC every day is exactly 86,400,000 ms, so `Date.UTC(y, m, d + 1)` is
 *    unconditionally correct.
 *  - **The remaining milliseconds are timezone-independent.** Two players in
 *    different countries see the same number on the countdown and a different
 *    wall-clock time for the reset. That is the correct behaviour, and it falls
 *    out of computing the instant once and formatting it per-viewer.
 *
 * ─── PROVENANCE ─────────────────────────────────────────────────────────────
 *
 * No API publishes OSRS reset times, so these are **authored data**, not
 * measured (contrast the price and WOM clients, whose behaviour was probed
 * live). Each rule therefore carries a `confidence` and a `source`, and the UI
 * surfaces anything below `documented` rather than presenting every row with
 * equal authority. Bump `RESET_RULES_VERSION` when a rule changes. (ADR-0019)
 */

/** Bump on any change to `RESET_RULES`. Rendered in the UI so a stale tab is obvious. */
export const RESET_RULES_VERSION = '2026-07-26.1';

/**
 * How much we actually know.
 *
 * `documented` — stated on the OSRS Wiki.
 * `community`  — widely agreed by players but not in a primary source.
 * `unverified` — plausible, modelled, and explicitly not confirmed.
 */
export type RuleConfidence = 'documented' | 'community' | 'unverified';

export type ResetCadence =
  | { kind: 'daily'; atHourUtc: number }
  /** `weekdayUtc` uses `Date#getUTCDay()` numbering: 0 = Sunday … 3 = Wednesday. */
  | { kind: 'weekly'; weekdayUtc: number; atHourUtc: number }
  | { kind: 'monthly'; dayOfMonthUtc: number; atHourUtc: number };

export interface ResetRule {
  id: string;
  label: string;
  /** What actually resets. Concrete examples beat the word "various". */
  description: string;
  cadence: ResetCadence;
  confidence: RuleConfidence;
  source: string;
}

export const RESET_RULES: readonly ResetRule[] = [
  {
    id: 'daily',
    label: 'Daily reset',
    description:
      'Bert’s buckets of sand, Nightmare Zone herb boxes, and the rest of the once-a-day allowances.',
    cadence: { kind: 'daily', atHourUtc: 0 },
    confidence: 'documented',
    source: 'OSRS Wiki — “Daily”, reset stated as 00:00 UTC',
  },
  {
    id: 'weekly',
    label: 'Weekly reset',
    description: 'Once-a-week content, Tears of Guthix being the one everyone tracks.',
    cadence: { kind: 'weekly', weekdayUtc: 3, atHourUtc: 0 },
    confidence: 'documented',
    source: 'OSRS Wiki — weekly content resets Wednesday 00:00 UTC',
  },
  {
    id: 'monthly',
    label: 'Monthly rollover',
    description:
      'Month-scoped counters and the start of a new calendar month for anything tracked per month.',
    cadence: { kind: 'monthly', dayOfMonthUtc: 1, atHourUtc: 0 },
    // Deliberately not dressed up as fact. The engine supports a monthly
    // cadence; which in-game content genuinely uses one is not something we
    // have a primary source for, and pretending otherwise is how a tool starts
    // quietly lying to its users.
    confidence: 'unverified',
    source: 'Calendar rollover in UTC. No in-game reset confirmed on this cadence.',
  },
];

/** Days in a UTC month. Day 0 of the next month is the last day of this one. */
function daysInUtcMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * The next occurrence of `cadence` **strictly after** `now`.
 *
 * "Strictly after" is the deliberate choice at the boundary: standing exactly
 * on the reset instant, the countdown shows a full period rather than zero.
 * A zero that lingers reads as a broken timer, and the reset has, by then,
 * already happened.
 */
export function nextResetAfter(cadence: ResetCadence, now: Date): Date {
  const nowMs = now.getTime();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const date = now.getUTCDate();

  switch (cadence.kind) {
    case 'daily': {
      const today = Date.UTC(year, month, date, cadence.atHourUtc);
      // `date + 1` rolls the month and the year on its own; UTC has no DST, so
      // there is no such thing as a 23-hour day to special-case.
      return new Date(
        today > nowMs ? today : Date.UTC(year, month, date + 1, cadence.atHourUtc),
      );
    }

    case 'weekly': {
      const daysAhead = (cadence.weekdayUtc - now.getUTCDay() + 7) % 7;
      const candidate = Date.UTC(year, month, date + daysAhead, cadence.atHourUtc);
      return new Date(
        candidate > nowMs
          ? candidate
          : Date.UTC(year, month, date + daysAhead + 7, cadence.atHourUtc),
      );
    }

    case 'monthly': {
      // Clamped, so "the 31st" in February means the 28th (or 29th) rather
      // than silently landing in March.
      const thisMonthDay = Math.min(cadence.dayOfMonthUtc, daysInUtcMonth(year, month));
      const candidate = Date.UTC(year, month, thisMonthDay, cadence.atHourUtc);
      if (candidate > nowMs) return new Date(candidate);

      const nextMonthDay = Math.min(
        cadence.dayOfMonthUtc,
        daysInUtcMonth(year, month + 1),
      );
      return new Date(Date.UTC(year, month + 1, nextMonthDay, cadence.atHourUtc));
    }
  }
}

/**
 * Milliseconds from `now` until the next occurrence. Always positive.
 *
 * This value is the same for every viewer on earth, which is exactly why the
 * countdown is computed here and the wall-clock time is computed per-viewer.
 */
export function msUntilReset(cadence: ResetCadence, now: Date): number {
  return nextResetAfter(cadence, now).getTime() - now.getTime();
}

export interface ResetStatus {
  rule: ResetRule;
  /** The reset instant, in UTC. Format it, never read `.getHours()` off it. */
  nextAt: Date;
  msRemaining: number;
}

export function resetStatuses(
  now: Date,
  rules: readonly ResetRule[] = RESET_RULES,
): ResetStatus[] {
  return rules
    .map((rule) => ({
      rule,
      nextAt: nextResetAfter(rule.cadence, now),
      msRemaining: msUntilReset(rule.cadence, now),
    }))
    .sort((a, b) => a.msRemaining - b.msRemaining);
}

/**
 * The reset instant as the viewer's own clock will show it.
 *
 * `Intl.DateTimeFormat` is doing the DST work: given `2026-07-01T00:00:00Z` and
 * `Europe/London` it yields 01:00 (BST), and given `2026-01-01T00:00:00Z` it
 * yields 00:00 (GMT). Hand-rolling that with a fixed offset is the off-by-one-
 * hour bug in another costume.
 *
 * `timeZone` is a parameter purely so tests can pin one; leaving it undefined
 * uses the viewer's, which is what the UI wants.
 */
export function formatResetLocal(instant: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone,
  }).format(instant);
}

/** The same instant in UTC, so a user can see what the game actually uses. */
export function formatResetUtc(instant: Date): string {
  return formatResetLocal(instant, 'UTC');
}

/**
 * True when the viewer's clock differs from UTC right now.
 *
 * Drives a "your clock is UTC+1 today" hint. Computed from the instant rather
 * than from a stored offset because the answer changes twice a year — a value
 * cached at page load is wrong for anyone who leaves the tab open across the
 * changeover.
 */
export function localOffsetMinutes(at: Date): number {
  return -at.getTimezoneOffset();
}

/** `UTC`, `UTC+1`, `UTC-5:30`. */
export function formatUtcOffset(offsetMinutes: number): string {
  if (offsetMinutes === 0) return 'UTC';
  const sign = offsetMinutes > 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return minutes === 0
    ? `UTC${sign}${hours}`
    : `UTC${sign}${hours}:${String(minutes).padStart(2, '0')}`;
}

/** Exported for the tests that assert a UTC day is always exactly 24h. */
export const UTC_DAY_MS = MS_PER_DAY;
