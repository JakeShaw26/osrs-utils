import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PrayerFlickTimer } from './PrayerFlickTimer';

/**
 * ─── WHY `toFake` IS NARROWED ───────────────────────────────────────────────
 *
 * We fake only the two clocks this component actually runs on:
 * `requestAnimationFrame` and `performance`. Faking everything — the default —
 * also replaces `setTimeout`, which `userEvent` uses internally to sequence the
 * events of a single click. With `setTimeout` faked and nothing advancing it,
 * every `await user.click(...)` hangs until the test times out. That failure
 * looks like a broken component and is entirely a test-harness problem, so it
 * is worth stating rather than rediscovering.
 *
 * Narrowing keeps `userEvent` on the real event loop while
 * `vi.advanceTimersByTime` still drives the animation frames and
 * `performance.now()` deterministically — which is the whole reason a
 * drift-free timer can be tested at all.
 */
const FAKE_CLOCKS = ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'];

function setup() {
  const user = userEvent.setup();
  const view = render(<PrayerFlickTimer />);
  return Object.assign(user, { view });
}

/** Reads the number out of a StatBadge group, e.g. "Ticks12" -> 12. */
function readStat(name: string): number {
  const text = screen.getByRole('group', { name }).textContent ?? '';
  const digits = text.match(/-?\d+(\.\d+)?/);
  return digits === null ? Number.NaN : Number(digits[0]);
}

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: FAKE_CLOCKS as never });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('PrayerFlickTimer', () => {
  it('starts stopped and at zero, so the server and client renders agree', () => {
    setup();

    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    expect(readStat('Game ticks elapsed')).toBe(0);
    expect(readStat('Seconds elapsed')).toBe(0);
  });

  it('runs on the 0.6s game tick once started', async () => {
    const user = setup();

    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();

    await advance(2_000);

    // 2000ms is three whole 600ms ticks with 200ms to spare. The range absorbs
    // the sub-frame offset between the click and the first animation frame;
    // it is deliberately too tight to pass if the beat were wrong.
    const ticks = readStat('Game ticks elapsed');
    expect(ticks).toBeGreaterThanOrEqual(3);
    expect(ticks).toBeLessThanOrEqual(4);
  });

  it('freezes when stopped and resumes rather than restarting', async () => {
    const user = setup();

    await user.click(screen.getByRole('button', { name: 'Start' }));
    await advance(1_800);
    await user.click(screen.getByRole('button', { name: 'Stop' }));

    const frozen = readStat('Game ticks elapsed');
    expect(frozen).toBeGreaterThan(0);

    await advance(10_000);
    expect(readStat('Game ticks elapsed')).toBe(frozen);

    // Resuming must not throw away what was already banked.
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await advance(1_200);
    expect(readStat('Game ticks elapsed')).toBeGreaterThanOrEqual(frozen + 1);
  });

  it('returns to zero and to a stopped state when reset', async () => {
    const user = setup();

    await user.click(screen.getByRole('button', { name: 'Start' }));
    await advance(3_000);
    expect(readStat('Game ticks elapsed')).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Reset' }));

    expect(readStat('Game ticks elapsed')).toBe(0);
    expect(readStat('Seconds elapsed')).toBe(0);
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
  });

  it('keeps the beat sweep within its bounds', async () => {
    const user = setup();

    await user.click(screen.getByRole('button', { name: 'Start' }));
    await advance(1_000);

    const value = Number(screen.getByRole('progressbar').getAttribute('aria-valuenow'));
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(100);
  });

  it('changes the beat length when a slower rhythm is chosen', async () => {
    const user = setup();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Flick rhythm' }),
      'double',
    );

    expect(readStat('Beat length')).toBe(1_200);
    // Ticks are still counted at the real game tick, not at the practice beat —
    // the two must not be conflated.
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await advance(2_400);
    expect(readStat('Flicks elapsed')).toBeLessThan(readStat('Game ticks elapsed'));
  });

  // A leaked rAF loop calls setState on an unmounted tree on every frame,
  // forever, and keeps the whole subtree alive in memory.
  it('cancels its animation frame on unmount', async () => {
    const cancel = vi.spyOn(globalThis, 'cancelAnimationFrame');
    const user = setup();

    await user.click(screen.getByRole('button', { name: 'Start' }));
    user.view.unmount();

    expect(cancel).toHaveBeenCalled();
  });
});
