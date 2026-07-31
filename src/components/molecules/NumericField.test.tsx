import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NumericField } from './NumericField';

/**
 * These assertions are the union of the three suites this component replaced
 * (`combat/NumberField`, `skilling/NumericField`, `quests/LevelField`). Each one
 * pins behaviour some slice was relying on, so the merge cannot quietly drop a
 * behaviour that only one caller depended on.
 */

describe('NumericField — text mode', () => {
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

  // Quests caps level boxes at three characters; the merge must keep it.
  it('honours maxLength', () => {
    render(
      <NumericField id="atk" label="Attack" value="" onChange={vi.fn()} maxLength={3} />,
    );

    expect(screen.getByRole('textbox', { name: 'Attack' })).toHaveAttribute(
      'maxLength',
      '3',
    );
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

describe('NumericField — number mode', () => {
  it('labels the control so it can be found by its accessible name', () => {
    render(
      <NumericField
        mode="number"
        id="str"
        label="Strength level"
        value={99}
        onValueChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('spinbutton', { name: 'Strength level' })).toHaveValue(99);
  });

  it('reports the parsed number as the user types', async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(
      <NumericField
        mode="number"
        id="kills"
        label="Kills"
        value={0}
        onValueChange={onValueChange}
      />,
    );

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
    render(
      <NumericField
        mode="number"
        id="kills"
        label="Kills"
        value={12}
        onValueChange={onValueChange}
      />,
    );

    await user.clear(screen.getByRole('spinbutton', { name: 'Kills' }));

    expect(onValueChange).toHaveBeenLastCalledWith(null);
  });

  it('renders an empty field rather than "NaN" when handed a non-finite value', () => {
    render(
      <NumericField
        mode="number"
        id="kills"
        label="Kills"
        value={Number.NaN}
        onValueChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('spinbutton', { name: 'Kills' })).toHaveValue(null);
  });

  it('passes min, max and step through to the control', () => {
    render(
      <NumericField
        mode="number"
        id="lvl"
        label="Level"
        value={70}
        onValueChange={vi.fn()}
        min={1}
        max={99}
        step={0.1}
      />,
    );
    const input = screen.getByRole('spinbutton', { name: 'Level' });

    expect(input).toHaveAttribute('min', '1');
    expect(input).toHaveAttribute('max', '99');
    expect(input).toHaveAttribute('step', '0.1');
  });

  it('marks an invalid field for assistive tech, not only visually', () => {
    render(
      <NumericField
        mode="number"
        id="kills"
        label="Kills"
        value={-1}
        onValueChange={vi.fn()}
        invalid
      />,
    );

    expect(screen.getByRole('spinbutton', { name: 'Kills' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('does not accept input while disabled', () => {
    render(
      <NumericField
        mode="number"
        id="kills"
        label="Kills"
        value={1}
        onValueChange={vi.fn()}
        disabled
      />,
    );

    expect(screen.getByRole('spinbutton', { name: 'Kills' })).toBeDisabled();
  });
});

describe('NumericField — hint and error', () => {
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

  /**
   * The hint text changes as the value changes ("+19 levels"). Inside the
   * `<label>` it would become part of the accessible name, so a screen reader
   * would announce a control whose name shifts while you type.
   */
  it('keeps the hint out of the accessible name', () => {
    render(
      <NumericField
        mode="number"
        id="potion"
        label="Potion"
        value={99}
        onValueChange={vi.fn()}
        hint="+19 levels"
      />,
    );

    expect(screen.getByRole('spinbutton', { name: 'Potion' })).toBeInTheDocument();
    expect(screen.getByText('+19 levels')).toBeInTheDocument();
  });
});
