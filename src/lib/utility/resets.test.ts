import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RESET_RULES,
  formatResetLocal,
  formatUtcOffset,
  msUntilReset,
  nextResetAfter,
  resetStatuses,
  type ResetCadence,
} from './resets';

/**
 * Every test here pins the clock with `vi.setSystemTime`.
 *
 * A time-dependent test that reads the real clock is flaky by construction: it
 * passes on a Tuesday and fails on a Wednesday, or passes in December and fails
 * in July. Worse for this module specifically — the DST bugs it exists to
 * prevent are invisible for roughly half the year, so a test run at the wrong
 * time of year would confirm a broken implementation.
 */

const DAILY: ResetCadence = { kind: 'daily', atHourUtc: 0 };
const WEEKLY_WEDNESDAY: ResetCadence = { kind: 'weekly', weekdayUtc: 3, atHourUtc: 0 };
const MONTHLY_FIRST: ResetCadence = { kind: 'monthly', dayOfMonthUtc: 1, atHourUtc: 0 };

const SECOND = 1_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('nextResetAfter — daily', () => {
  it('returns 1s remaining one second before the reset', () => {
    const now = new Date('2026-07-26T23:59:59.000Z');

    expect(msUntilReset(DAILY, now)).toBe(SECOND);
    expect(nextResetAfter(DAILY, now).toISOString()).toBe('2026-07-27T00:00:00.000Z');
  });

  // Standing exactly on the boundary, the reset has already happened. Showing 0
  // would leave a stuck timer on screen for a whole second.
  it('rolls to tomorrow when standing exactly on the reset instant', () => {
    const now = new Date('2026-07-27T00:00:00.000Z');

    expect(msUntilReset(DAILY, now)).toBe(DAY);
    expect(nextResetAfter(DAILY, now).toISOString()).toBe('2026-07-28T00:00:00.000Z');
  });

  it('returns nearly a full day one second after the reset', () => {
    const now = new Date('2026-07-27T00:00:01.000Z');

    expect(msUntilReset(DAILY, now)).toBe(DAY - SECOND);
  });

  it('rolls the month and the year', () => {
    expect(nextResetAfter(DAILY, new Date('2026-12-31T12:00:00Z')).toISOString()).toBe(
      '2027-01-01T00:00:00.000Z',
    );
  });
});

describe('nextResetAfter — DST', () => {
  /**
   * The whole point of the module. In the UK, BST (UTC+1) runs from the last
   * Sunday in March to the last Sunday in October. A daily countdown built on
   * *local* midnight is an hour wrong for that entire period — and correct for
   * the rest of the year, which is why the bug survives casual testing.
   *
   * These two cases are identical in UTC and land on different local clock
   * times, which is exactly the behaviour we want.
   */
  it('gives the same remaining time inside and outside BST', () => {
    const insideBst = new Date('2026-07-15T22:00:00.000Z');
    const outsideBst = new Date('2026-01-15T22:00:00.000Z');

    expect(msUntilReset(DAILY, insideBst)).toBe(2 * HOUR);
    expect(msUntilReset(DAILY, outsideBst)).toBe(2 * HOUR);
  });

  it('renders the same UTC reset at a different London wall-clock time in BST', () => {
    const summerReset = nextResetAfter(DAILY, new Date('2026-07-15T22:00:00Z'));
    const winterReset = nextResetAfter(DAILY, new Date('2026-01-15T22:00:00Z'));

    // 00:00 UTC is 01:00 in London during BST, and 00:00 during GMT.
    expect(formatResetLocal(summerReset, 'Europe/London')).toContain('01:00');
    expect(formatResetLocal(winterReset, 'Europe/London')).toContain('00:00');
  });

  it('counts exactly 24 hours across the spring-forward Sunday', () => {
    // 2026-03-29 is the day the UK loses an hour: local midnight to local
    // midnight is 23 hours. In UTC it is still 24, and the countdown must
    // agree with UTC, not with the wall clock.
    const beforeChangeover = new Date('2026-03-28T00:00:00.001Z');

    expect(msUntilReset(DAILY, beforeChangeover)).toBe(DAY - 1);
    expect(nextResetAfter(DAILY, beforeChangeover).toISOString()).toBe(
      '2026-03-29T00:00:00.000Z',
    );
  });

  it('counts exactly 24 hours across the autumn fall-back Sunday', () => {
    // 2026-10-25, the 25-hour local day.
    const beforeChangeover = new Date('2026-10-24T00:00:00.001Z');

    expect(msUntilReset(DAILY, beforeChangeover)).toBe(DAY - 1);
  });

  it('formats a southern-hemisphere zone whose date differs from UTC', () => {
    // Sydney is UTC+10/+11, so 00:00 UTC lands on the *following* local day.
    // A naive local-date implementation is a full day out here, not an hour.
    const reset = nextResetAfter(DAILY, new Date('2026-07-15T22:00:00Z'));

    expect(formatResetLocal(reset, 'Australia/Sydney')).toContain('10:00');
  });
});

describe('nextResetAfter — weekly', () => {
  // 2026-07-26 is a Sunday; 2026-07-29 is the following Wednesday.
  it('finds the coming Wednesday from earlier in the week', () => {
    expect(
      nextResetAfter(WEEKLY_WEDNESDAY, new Date('2026-07-26T12:00:00Z')).toISOString(),
    ).toBe('2026-07-29T00:00:00.000Z');
  });

  it('returns 1s remaining one second before the weekly reset', () => {
    expect(msUntilReset(WEEKLY_WEDNESDAY, new Date('2026-07-28T23:59:59Z'))).toBe(SECOND);
  });

  // The week boundary: on reset day but past the hour, the answer is next week,
  // not today. Getting this wrong shows "0s" for 24 hours.
  it('jumps a full week when the reset day has already passed its hour', () => {
    expect(
      nextResetAfter(WEEKLY_WEDNESDAY, new Date('2026-07-29T00:00:00Z')).toISOString(),
    ).toBe('2026-08-05T00:00:00.000Z');

    expect(
      nextResetAfter(WEEKLY_WEDNESDAY, new Date('2026-07-29T13:00:00Z')).toISOString(),
    ).toBe('2026-08-05T00:00:00.000Z');
  });

  it('never returns more than seven days', () => {
    for (let hour = 0; hour < 24 * 8; hour += 1) {
      const now = new Date(Date.UTC(2026, 6, 20, hour));
      const remaining = msUntilReset(WEEKLY_WEDNESDAY, now);

      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(7 * DAY);
    }
  });
});

describe('nextResetAfter — monthly', () => {
  it('finds the first of next month', () => {
    expect(
      nextResetAfter(MONTHLY_FIRST, new Date('2026-07-15T00:00:00Z')).toISOString(),
    ).toBe('2026-08-01T00:00:00.000Z');
  });

  it('rolls the year', () => {
    expect(
      nextResetAfter(MONTHLY_FIRST, new Date('2026-12-15T00:00:00Z')).toISOString(),
    ).toBe('2027-01-01T00:00:00.000Z');
  });

  it('clamps a day-of-month that the target month does not have', () => {
    const thirtyFirst: ResetCadence = {
      kind: 'monthly',
      dayOfMonthUtc: 31,
      atHourUtc: 0,
    };

    // February 2026 has 28 days, so "the 31st" clamps rather than sliding into
    // March — which would skip the reset entirely.
    expect(
      nextResetAfter(thirtyFirst, new Date('2026-02-10T00:00:00Z')).toISOString(),
    ).toBe('2026-02-28T00:00:00.000Z');
  });

  it('handles a leap year', () => {
    const twentyNinth: ResetCadence = {
      kind: 'monthly',
      dayOfMonthUtc: 29,
      atHourUtc: 0,
    };

    expect(
      nextResetAfter(twentyNinth, new Date('2028-02-10T00:00:00Z')).toISOString(),
    ).toBe('2028-02-29T00:00:00.000Z');
  });
});

describe('resetStatuses', () => {
  it('orders the shipped rules soonest first', () => {
    const statuses = resetStatuses(new Date('2026-07-26T12:00:00Z'));

    expect(statuses).toHaveLength(RESET_RULES.length);
    const remaining = statuses.map((status) => status.msRemaining);
    expect([...remaining].sort((a, b) => a - b)).toEqual(remaining);
  });

  it('reads the pinned system clock when given no explicit instant', () => {
    // The component calls `new Date()`; pinning the system clock is what makes
    // that path testable at all rather than only the injected-date path.
    vi.setSystemTime(new Date('2026-07-26T23:00:00Z'));

    const statuses = resetStatuses(new Date());

    expect(statuses[0]?.rule.id).toBe('daily');
    expect(statuses[0]?.msRemaining).toBe(HOUR);
  });

  it('never reports a non-positive countdown for a shipped rule', () => {
    // Sweep an entire year at hourly resolution: every rule must always have a
    // strictly positive next occurrence, whatever day, month or DST state.
    for (let hour = 0; hour < 24 * 365; hour += 7) {
      const now = new Date(Date.UTC(2026, 0, 1, hour));
      for (const status of resetStatuses(now)) {
        expect(status.msRemaining).toBeGreaterThan(0);
      }
    }
  });
});

describe('formatUtcOffset', () => {
  it('names UTC itself rather than "UTC+0"', () => {
    expect(formatUtcOffset(0)).toBe('UTC');
  });

  it('formats whole and half-hour offsets in both directions', () => {
    expect(formatUtcOffset(60)).toBe('UTC+1');
    expect(formatUtcOffset(-300)).toBe('UTC-5');
    expect(formatUtcOffset(330)).toBe('UTC+5:30');
    expect(formatUtcOffset(-210)).toBe('UTC-3:30');
  });
});
