import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { COUNTDOWN_PLACEHOLDER } from '@/components/atoms/utility/Countdown';
import { ResetTracker } from './ResetTracker';

beforeEach(() => {
  vi.useFakeTimers();
  // Sunday 26 July 2026, 22:00 UTC. Pinned so "3 days until Wednesday" is a
  // fact about the test and not about the day it happens to run.
  vi.setSystemTime(new Date('2026-07-26T22:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ResetTracker', () => {
  /**
   * The hydration guarantee, tested where it actually happens.
   *
   * React compares the server HTML against the first client render. If this
   * component read the clock during render, those two would disagree by
   * however many milliseconds the network took, and React would throw a
   * hydration mismatch. Rendering to static markup is the only way to observe
   * the server output directly — in a normal `render()` the effect has already
   * run by the time we can query.
   */
  it('server-renders placeholders and no time value', () => {
    const html = renderToStaticMarkup(<ResetTracker />);

    expect(html).toContain(COUNTDOWN_PLACEHOLDER);
    // The names and descriptions are still server-rendered and indexable —
    // only the numbers are deferred.
    expect(html).toContain('Daily reset');

    // No countdown value, no wall-clock time, no timezone hint may appear
    // before the client knows what timezone the viewer is in.
    expect(html).not.toMatch(/aria-label="Time until [^"]*\d/);
    expect(html).not.toContain('Your clock is currently');
  });

  it('shows real countdowns once the client clock starts', async () => {
    await act(async () => {
      render(<ResetTracker />);
    });

    // Two hours to 00:00 UTC from the pinned 22:00.
    expect(
      screen.getByRole('timer', { name: /Time until Daily reset/ }),
    ).toHaveTextContent('02:00:00');
  });

  it('counts down as time passes', async () => {
    await act(async () => {
      render(<ResetTracker />);
    });

    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });

    expect(
      screen.getByRole('timer', { name: /Time until Daily reset/ }),
    ).toHaveTextContent('01:59:55');
  });

  it('orders the resets soonest first once the clock is running', async () => {
    await act(async () => {
      render(<ResetTracker />);
    });

    const headings = screen
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);

    expect(headings[0]).toBe('Daily reset');
  });

  // Wednesday is three days after the pinned Sunday, so the weekly card must
  // cross the day boundary in its format.
  it('shows the weekly reset with a day segment', async () => {
    await act(async () => {
      render(<ResetTracker />);
    });

    expect(
      screen.getByRole('timer', { name: /Time until Weekly reset/ }),
    ).toHaveTextContent('2d 02:00:00');
  });

  // Authored rules, not measured ones. Anything we cannot source properly is
  // badged rather than presented with the same authority as the rest.
  it('badges a rule we are not certain about', async () => {
    await act(async () => {
      render(<ResetTracker />);
    });

    expect(screen.getByText('unverified')).toBeInTheDocument();
  });

  it('stops its interval when unmounted', async () => {
    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(<ResetTracker />);
    });

    view.unmount();

    // A leaked interval calls setState on an unmounted tree forever. If the
    // cleanup were missing, advancing the clock here would warn or throw.
    expect(() => vi.advanceTimersByTime(10_000)).not.toThrow();
  });
});
