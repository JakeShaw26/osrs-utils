import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DropRateCalculator } from './DropRateCalculator';

/**
 * The binomial maths is covered in `lib/combat/drop-rate.test.ts`. What is worth
 * asserting here is that a user's typo produces a stated error rather than a
 * silent "NaN%", which is the failure mode of every hand-rolled number field.
 */

function chance(): string {
  return screen.getByRole('status', { name: 'Chance of at least one' }).textContent ?? '';
}

describe('DropRateCalculator', () => {
  it('shows the odds for its default 1/512 over 512 kills', () => {
    render(<DropRateCalculator />);

    expect(chance()).toBe('63.25%');
  });

  it('recomputes as the kill count changes', async () => {
    const user = userEvent.setup();
    render(<DropRateCalculator />);

    const kills = screen.getByRole('spinbutton', { name: 'Kills' });
    await user.clear(kills);
    await user.type(kills, '100');

    expect(chance()).toBe('17.76%');
  });

  it('lists the kills needed for each confidence level', () => {
    render(<DropRateCalculator />);

    const table = screen.getByRole('table');
    expect(table).toHaveTextContent('99.00%');
    expect(table).toHaveTextContent('2,356');
  });

  /**
   * An empty or fractional field must produce a stated empty state, not a
   * rendered "NaN%". Users clear a field before retyping constantly.
   */
  it('states why it cannot answer instead of rendering NaN', async () => {
    const user = userEvent.setup();
    render(<DropRateCalculator />);

    await user.clear(screen.getByRole('spinbutton', { name: 'Kills' }));

    expect(screen.queryByRole('status', { name: 'Chance of at least one' })).toBeNull();
    expect(screen.getByText(/Enter a drop rate and a kill count/)).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Kills' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('rejects a drop rate denominator below one', async () => {
    const user = userEvent.setup();
    render(<DropRateCalculator />);

    const rate = screen.getByRole('spinbutton', { name: 'Drop rate — 1 in' });
    await user.clear(rate);
    await user.type(rate, '0');

    expect(screen.getByText('Enter a denominator of 1 or more')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('reports zero kills as a zero chance rather than an error', async () => {
    const user = userEvent.setup();
    render(<DropRateCalculator />);

    const kills = screen.getByRole('spinbutton', { name: 'Kills' });
    await user.clear(kills);
    await user.type(kills, '0');

    expect(chance()).toBe('0.00%');
  });
});
