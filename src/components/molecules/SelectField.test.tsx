import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelectField, toOptions } from './SelectField';

const OPTIONS = toOptions(['Melee', 'Ranged', 'Magic']);

describe('SelectField', () => {
  it('associates its label with the control, so it has an accessible name', () => {
    render(
      <SelectField
        id="style"
        label="Combat style"
        value="Melee"
        options={OPTIONS}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('combobox', { name: 'Combat style' })).toHaveValue('Melee');
  });

  it('reports the chosen value, not the event', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <SelectField
        id="style"
        label="Combat style"
        value="Melee"
        options={OPTIONS}
        onChange={onChange}
      />,
    );

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Combat style' }),
      'Magic',
    );

    expect(onChange).toHaveBeenLastCalledWith('Magic');
  });

  // The hint describes the control rather than naming it, so the accessible
  // name stays the label alone.
  it('describes the control with its hint without renaming it', () => {
    render(
      <SelectField
        id="style"
        label="Combat style"
        value="Melee"
        options={OPTIONS}
        onChange={vi.fn()}
        hint="Sets which bonuses apply."
      />,
    );

    expect(screen.getByRole('combobox', { name: 'Combat style' })).toHaveAttribute(
      'aria-describedby',
      'style-hint',
    );
    expect(screen.getByText('Sets which bonuses apply.')).toBeInTheDocument();
  });

  it('can be disabled', () => {
    render(
      <SelectField
        id="style"
        label="Combat style"
        value="Melee"
        options={OPTIONS}
        onChange={vi.fn()}
        disabled
      />,
    );

    expect(screen.getByRole('combobox', { name: 'Combat style' })).toBeDisabled();
  });
});
