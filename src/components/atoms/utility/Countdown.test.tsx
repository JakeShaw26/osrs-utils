import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { COUNTDOWN_PLACEHOLDER, Countdown } from './Countdown';

describe('Countdown', () => {
  it('renders a formatted countdown with an accessible name', () => {
    render(<Countdown ms={3_723_000} label="Time until daily reset" />);

    expect(
      screen.getByRole('timer', { name: 'Time until daily reset: 01:02:03' }),
    ).toHaveTextContent('01:02:03');
  });

  // The property that prevents a hydration mismatch. The server cannot know the
  // current time in the viewer's zone, so the owning organism passes null and
  // both renders agree on this string.
  it('renders a stable placeholder when it has no value yet', () => {
    render(<Countdown ms={null} label="Time until daily reset" />);

    expect(screen.getByRole('timer')).toHaveTextContent(COUNTDOWN_PLACEHOLDER);
  });

  it('describes the placeholder state to assistive tech rather than reading dashes', () => {
    render(<Countdown ms={null} label="Time until weekly reset" />);

    expect(
      screen.getByRole('timer', { name: 'Time until weekly reset: calculating' }),
    ).toBeInTheDocument();
  });

  // One of the two class assertions docs/testing.md allows: `.tabular` carries
  // real behaviour. Without fixed-width digits the whole row twitches sideways
  // once a second as the numbers change width.
  it('uses tabular figures so the digits do not jitter', () => {
    render(<Countdown ms={1_000} label="Time until reset" />);

    expect(screen.getByRole('timer')).toHaveClass('tabular');
  });

  it('does not announce itself on every change', () => {
    render(<Countdown ms={1_000} label="Time until reset" />);

    // A live region updating once a second makes a page unusable with a screen
    // reader, and a countdown is not urgent.
    expect(screen.getByRole('timer')).toHaveAttribute('aria-live', 'off');
  });

  it('keeps the same width past a day, where the format changes', () => {
    render(<Countdown ms={90_000_000} label="Time until monthly reset" />);

    expect(screen.getByRole('timer')).toHaveTextContent('1d 01:00:00');
  });
});
