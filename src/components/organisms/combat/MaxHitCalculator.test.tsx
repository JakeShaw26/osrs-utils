import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MaxHitCalculator } from './MaxHitCalculator';

/**
 * Component tests only. The formulas are covered by `lib/combat/max-hit.test.ts`
 * — repeating them here would double the maintenance for none of the coverage
 * (docs/testing.md). What is worth asserting is that the form is labelled, that
 * changing an input changes the number a user reads, and that a cleared field
 * does not render "NaN".
 */

function maxHit(): string {
  return screen.getByRole('status', { name: 'Maximum hit' }).textContent ?? '';
}

describe('MaxHitCalculator', () => {
  it('renders a result for its default melee setup', () => {
    render(<MaxHitCalculator />);

    // 99 Strength, Piety, Aggressive, +118 strength: effective 132 → 38.
    expect(screen.getByRole('spinbutton', { name: 'Strength level' })).toHaveValue(99);
    expect(maxHit()).toBe('38');
  });

  it('recomputes when the strength bonus changes', async () => {
    const user = userEvent.setup();
    render(<MaxHitCalculator />);

    const bonus = screen.getByRole('spinbutton', { name: 'Strength bonus' });
    await user.clear(bonus);
    await user.type(bonus, '0');

    expect(maxHit()).toBe('13');
  });

  it('recomputes when the prayer changes', async () => {
    const user = userEvent.setup();
    render(<MaxHitCalculator />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Prayer' }), 'none');

    expect(maxHit()).toBe('31');
  });

  /**
   * The 7/6 black mask only applies on task, and forgetting the checkbox is the
   * most common way a slayer number comes out wrong.
   */
  it('applies the black mask only once the slayer task box is ticked', async () => {
    const user = userEvent.setup();
    render(<MaxHitCalculator />);

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Black mask' }),
      'black mask',
    );
    expect(maxHit()).toBe('38');

    await user.click(screen.getByRole('checkbox', { name: 'On slayer task' }));
    expect(maxHit()).toBe('44'); // ⌊38 × 7/6⌋
  });

  it('swaps the form over to ranged inputs when the class changes', async () => {
    const user = userEvent.setup();
    render(<MaxHitCalculator />);

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Combat class' }),
      'ranged',
    );

    expect(screen.getByRole('spinbutton', { name: 'Ranged level' })).toBeInTheDocument();
    expect(
      screen.getByRole('spinbutton', { name: 'Ranged strength bonus' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: 'Strength level' })).toBeNull();
  });

  it('offers a spell and staff picker for magic, and no strength bonus field', async () => {
    const user = userEvent.setup();
    render(<MaxHitCalculator />);

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Combat class' }),
      'magic',
    );

    expect(screen.getByRole('combobox', { name: 'Spell or staff' })).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: 'Strength bonus' })).toBeNull();
    expect(maxHit()).toBe('24'); // Fire surge, no magic damage bonus
  });

  it('scales a powered staff with the Magic level', async () => {
    const user = userEvent.setup();
    render(<MaxHitCalculator />);

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Combat class' }),
      'magic',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Spell or staff' }),
      "staff:Tumeken's shadow",
    );

    expect(maxHit()).toBe('34'); // ⌊99/3 + 1⌋
  });

  /**
   * Users clear a field before retyping constantly. An empty level must not
   * reach the formulas — `NaN` propagates and renders as the string "NaN",
   * which reads as a crash rather than as an empty input.
   */
  it('never renders NaN when a level field is cleared', async () => {
    const user = userEvent.setup();
    render(<MaxHitCalculator />);

    await user.clear(screen.getByRole('spinbutton', { name: 'Strength level' }));

    expect(screen.getByRole('status', { name: 'Maximum hit' })).not.toHaveTextContent(
      'NaN',
    );
    expect(Number(maxHit())).toBeGreaterThanOrEqual(0);
  });

  it('disables the Dharok hitpoint fields until the set is selected', async () => {
    const user = userEvent.setup();
    render(<MaxHitCalculator />);

    expect(screen.getByRole('spinbutton', { name: 'Current hitpoints' })).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: "Dharok's set" }));

    expect(screen.getByRole('spinbutton', { name: 'Current hitpoints' })).toBeEnabled();
  });

  it('raises the maximum hit as Dharok hitpoints fall', async () => {
    const user = userEvent.setup();
    render(<MaxHitCalculator />);

    await user.click(screen.getByRole('checkbox', { name: "Dharok's set" }));
    const current = screen.getByRole('spinbutton', { name: 'Current hitpoints' });
    await user.clear(current);
    await user.type(current, '1');

    expect(Number(maxHit())).toBeGreaterThan(60);
  });
});
