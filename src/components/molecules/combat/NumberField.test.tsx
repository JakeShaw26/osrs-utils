import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NumberField } from './NumberField';

describe('NumberField', () => {
  it('labels the control so it can be found by its accessible name', () => {
    render(<NumberField label="Strength level" value={99} onValueChange={vi.fn()} />);

    expect(screen.getByRole('spinbutton', { name: 'Strength level' })).toHaveValue(99);
  });

  /**
   * The hint text changes as the value changes ("+19 levels"). If it were inside
   * the `<label>` it would become part of the accessible name, so a screen
   * reader would announce a control whose name shifts while you type.
   */
  it('keeps the hint out of the accessible name', () => {
    render(
      <NumberField label="Potion" value={99} onValueChange={vi.fn()} hint="+19 levels" />,
    );

    expect(screen.getByRole('spinbutton', { name: 'Potion' })).toBeInTheDocument();
    expect(screen.getByText('+19 levels')).toBeInTheDocument();
  });

  it('reports the parsed number as the user types', async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(<NumberField label="Kills" value={0} onValueChange={onValueChange} />);

    await user.type(screen.getByRole('spinbutton', { name: 'Kills' }), '7');

    expect(onValueChange).toHaveBeenLastCalledWith(7);
  });

  /**
   * A cleared number field parses to `NaN`, which then propagates through every
   * downstream formula and renders as the string "NaN". Reporting `null` makes
   * the caller decide what empty means instead of poisoning the calculation.
   */
  it('reports null rather than NaN when cleared', async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(<NumberField label="Kills" value={12} onValueChange={onValueChange} />);

    await user.clear(screen.getByRole('spinbutton', { name: 'Kills' }));

    expect(onValueChange).toHaveBeenLastCalledWith(null);
  });

  it('renders an empty field rather than "NaN" when handed a non-finite value', () => {
    render(<NumberField label="Kills" value={Number.NaN} onValueChange={vi.fn()} />);

    expect(screen.getByRole('spinbutton', { name: 'Kills' })).toHaveValue(null);
  });

  it('marks an invalid field for assistive tech, not only visually', () => {
    render(<NumberField label="Kills" value={-1} onValueChange={vi.fn()} invalid />);

    expect(screen.getByRole('spinbutton', { name: 'Kills' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('does not accept input while disabled', () => {
    render(<NumberField label="Kills" value={1} onValueChange={vi.fn()} disabled />);

    expect(screen.getByRole('spinbutton', { name: 'Kills' })).toBeDisabled();
  });
});
