import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NumericField } from './NumericField';

describe('NumericField', () => {
  it('associates its label with the input, so it has an accessible name', () => {
    render(<NumericField id="xp" label="Current XP" value="" onChange={vi.fn()} />);

    expect(screen.getByRole('textbox', { name: 'Current XP' })).toBeInTheDocument();
  });

  /**
   * Deliberately NOT `type="number"`. A native number input discards `1,000`
   * and `13m`, handing the caller an empty string that reads as 0 — the
   * calculator then confidently answers the wrong question.
   */
  it('is a text input with a numeric keypad hint, not a number input', () => {
    render(<NumericField id="xp" label="Current XP" value="" onChange={vi.fn()} />);
    const input = screen.getByRole('textbox', { name: 'Current XP' });

    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('inputMode', 'numeric');
  });

  it('reports every keystroke to the caller', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<NumericField id="xp" label="Current XP" value="" onChange={onChange} />);

    await user.type(screen.getByRole('textbox', { name: 'Current XP' }), '99');

    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('passes the value through unchanged, including shorthand', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<NumericField id="xp" label="Current XP" value="" onChange={onChange} />);

    await user.type(screen.getByRole('textbox', { name: 'Current XP' }), 'm');

    expect(onChange).toHaveBeenLastCalledWith('m');
  });

  it('marks the field invalid and announces the error when one is given', () => {
    render(
      <NumericField
        id="xp"
        label="Current XP"
        value="abc"
        onChange={vi.fn()}
        error="Enter a number."
      />,
    );

    expect(screen.getByRole('textbox', { name: 'Current XP' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a number.');
  });

  it('is not marked invalid when there is no error', () => {
    render(<NumericField id="xp" label="Current XP" value="99" onChange={vi.fn()} />);

    expect(screen.getByRole('textbox', { name: 'Current XP' })).not.toHaveAttribute(
      'aria-invalid',
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // Both, not one or the other: an error must not silently replace the guidance
  // a screen reader user needs to correct it.
  it('describes the input with the hint and the error at the same time', () => {
    render(
      <NumericField
        id="xp"
        label="Current XP"
        value="abc"
        onChange={vi.fn()}
        hint="From your skill tab."
        error="Enter a number."
      />,
    );

    const described = screen
      .getByRole('textbox', { name: 'Current XP' })
      .getAttribute('aria-describedby');

    expect(described).toContain('xp-hint');
    expect(described).toContain('xp-error');
  });

  it('renders a suffix beside the input', () => {
    render(
      <NumericField
        id="xp"
        label="Current XP"
        value="99"
        onChange={vi.fn()}
        suffix="lvl 1"
      />,
    );

    expect(screen.getByText('lvl 1')).toBeInTheDocument();
  });

  it('can be disabled', () => {
    render(
      <NumericField id="xp" label="Current XP" value="" onChange={vi.fn()} disabled />,
    );

    expect(screen.getByRole('textbox', { name: 'Current XP' })).toBeDisabled();
  });
});
