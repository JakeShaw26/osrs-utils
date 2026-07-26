import { describe, expect, it } from 'vitest';
import {
  MS_PER_DAY,
  MS_PER_HOUR,
  MS_PER_MINUTE,
  formatCountdown,
  formatDurationLong,
  splitDuration,
} from './duration';

describe('splitDuration', () => {
  it('splits a mixed duration', () => {
    const parts = splitDuration(
      2 * MS_PER_DAY + 3 * MS_PER_HOUR + 14 * MS_PER_MINUTE + 7_000,
    );

    expect(parts).toEqual({
      days: 2,
      hours: 3,
      minutes: 14,
      seconds: 7,
      negative: false,
    });
  });

  // Truncating, not rounding. With 500ms left, rounding would print "1s" and
  // then jump to zero — a countdown must never claim more time than remains.
  it('truncates sub-second remainders rather than rounding up', () => {
    expect(splitDuration(1_999).seconds).toBe(1);
    expect(splitDuration(999).seconds).toBe(0);
  });

  it('flags a negative duration without producing negative parts', () => {
    const parts = splitDuration(-90_000);

    expect(parts.negative).toBe(true);
    expect(parts.minutes).toBe(1);
    expect(parts.seconds).toBe(30);
  });
});

describe('formatCountdown', () => {
  it('pads to a fixed width so nothing reflows as it counts down', () => {
    expect(formatCountdown(0)).toBe('00:00:00');
    expect(formatCountdown(9_000)).toBe('00:00:09');
    expect(formatCountdown(MS_PER_HOUR + 2 * MS_PER_MINUTE + 3_000)).toBe('01:02:03');
  });

  it('is the same length either side of a digit rollover', () => {
    expect(formatCountdown(9_000)).toHaveLength(formatCountdown(10_000).length);
    expect(formatCountdown(59_000)).toHaveLength(formatCountdown(60_000).length);
  });

  // "0d 00:04:00" on a four-minute timer is noise, so the day segment only
  // appears once there is a day to report.
  it('adds a day segment only past 24 hours', () => {
    expect(formatCountdown(23 * MS_PER_HOUR)).toBe('23:00:00');
    expect(formatCountdown(MS_PER_DAY)).toBe('1d 00:00:00');
    expect(formatCountdown(2 * MS_PER_DAY + MS_PER_HOUR)).toBe('2d 01:00:00');
  });

  it('marks a negative duration', () => {
    expect(formatCountdown(-5_000)).toBe('-00:00:05');
  });
});

describe('formatDurationLong', () => {
  it('reads as prose for estimates', () => {
    expect(formatDurationLong(2 * MS_PER_HOUR + 30 * MS_PER_MINUTE)).toBe('2h 30m');
    expect(formatDurationLong(47 * MS_PER_MINUTE)).toBe('47m');
    expect(formatDurationLong(MS_PER_DAY + 3 * MS_PER_HOUR)).toBe('1d 3h');
  });

  // "0m" reads as "instant", which is wrong for a 30-second estimate.
  it('says so when there is nothing meaningful to report', () => {
    expect(formatDurationLong(0)).toBe('less than a minute');
    expect(formatDurationLong(30_000)).toBe('less than a minute');
  });

  it('drops minutes once days are involved, where they add nothing', () => {
    expect(formatDurationLong(MS_PER_DAY + MS_PER_HOUR + 17 * MS_PER_MINUTE)).toBe(
      '1d 1h',
    );
  });
});
