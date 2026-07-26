/**
 * Duration splitting and formatting.
 *
 * Separate from resets.ts because the minigame calculator needs "how long is
 * 47 games at 6 games/hour" too, and a countdown that formats itself is a
 * countdown that cannot be unit-tested without a clock.
 *
 * Everything here is arithmetic on a millisecond count. No Date, no timezone,
 * no locale — a duration is not a point in time and does not have either.
 */

export interface DurationParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** True when the input was negative — the caller decides how to present it. */
  negative: boolean;
}

export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * Splits milliseconds into d/h/m/s.
 *
 * Truncates rather than rounds. A countdown that rounds shows "1s" for 500ms
 * remaining and then jumps to "0s" — it must never claim more time than is
 * actually left, so seconds tick down through the whole second they name.
 */
export function splitDuration(ms: number): DurationParts {
  const negative = ms < 0;
  const abs = Math.abs(Math.trunc(ms));

  return {
    negative,
    days: Math.floor(abs / MS_PER_DAY),
    hours: Math.floor(abs / MS_PER_HOUR) % 24,
    minutes: Math.floor(abs / MS_PER_MINUTE) % 60,
    seconds: Math.floor(abs / MS_PER_SECOND) % 60,
  };
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * A fixed-width countdown: `03:14:07`, or `2d 03:14:07` past a day.
 *
 * Fixed width is the point. Rendered with `.tabular`, the string never changes
 * width as it counts down, so nothing on the row shifts sideways once a second.
 * The day segment is the one exception — it is dropped entirely below 24h
 * because "0d" on a 40-minute timer is noise.
 */
export function formatCountdown(ms: number): string {
  const { days, hours, minutes, seconds, negative } = splitDuration(ms);
  const clock = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  const body = days > 0 ? `${days}d ${clock}` : clock;
  return negative ? `-${body}` : body;
}

/** Prose form for estimates: `2d 3h`, `47m`, `less than a minute`. */
export function formatDurationLong(ms: number): string {
  const { days, hours, minutes, negative } = splitDuration(ms);

  const segments: string[] = [];
  if (days > 0) segments.push(`${days}d`);
  if (hours > 0) segments.push(`${hours}h`);
  // Only show minutes when they are the finest unit that still reads usefully.
  if (minutes > 0 && days === 0) segments.push(`${minutes}m`);

  if (segments.length === 0) return 'less than a minute';
  return `${negative ? '-' : ''}${segments.join(' ')}`;
}
