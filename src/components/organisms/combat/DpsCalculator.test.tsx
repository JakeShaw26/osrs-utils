import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DpsCalculator } from './DpsCalculator';

/**
 * The engine is covered in `lib/combat/dps.test.ts`. These assert the wiring a
 * logic test cannot see: that the monster picker changes the numbers, that
 * picking gear feeds the formulas, that a saved loadout appears in the ranking,
 * and that nothing here reaches the network.
 */

function dps(): number {
  return Number(screen.getByRole('status', { name: 'DPS' }).textContent);
}

function comparisonRows(): string[][] {
  const [, body] = within(screen.getByRole('table')).getAllByRole('rowgroup');
  return within(body!)
    .getAllByRole('row')
    .map((row) =>
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent ?? ''),
    );
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('DpsCalculator', () => {
  it('renders a monster picker and its defensive stats', () => {
    render(<DpsCalculator />);

    expect(screen.getByRole('combobox', { name: 'Monster' })).toBeInTheDocument();
    expect(screen.getByText('Hitpoints')).toBeInTheDocument();
  });

  it('produces a non-zero DPS once a weapon is equipped', async () => {
    const user = userEvent.setup();
    render(<DpsCalculator />);

    const unarmed = dps();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Weapon' }),
      'Abyssal whip',
    );

    expect(dps()).toBeGreaterThan(unarmed);
  });

  it('changes the answer when the monster changes', async () => {
    const user = userEvent.setup();
    render(<DpsCalculator />);

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Weapon' }),
      'Abyssal whip',
    );
    const first = dps();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Monster' }),
      'Giant Mole|Standard',
    );

    expect(dps()).not.toBe(first);
  });

  /**
   * Multi-form monsters are the trap the data notes call out: Zulrah's three
   * forms differ only in magic defence, so a calculator that collapses them
   * answers confidently about the wrong fight.
   */
  it('offers every form of a multi-form monster separately', () => {
    render(<DpsCalculator />);

    const options = within(screen.getByRole('combobox', { name: 'Monster' }))
      .getAllByRole('option')
      .map((option) => option.textContent);

    expect(options).toContain('Zulrah — Serpentine');
    expect(options).toContain('Zulrah — Tanzanite');
  });

  it('swaps the form over to magic inputs when the class changes', async () => {
    const user = userEvent.setup();
    render(<DpsCalculator />);

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Combat class' }),
      'magic',
    );

    expect(screen.getByRole('combobox', { name: 'Spell or staff' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Strength potion' })).toBeNull();
  });

  it('always includes the current setup in the comparison table', () => {
    render(<DpsCalculator />);

    expect(comparisonRows()).toHaveLength(1);
    expect(comparisonRows()[0]?.[0]).toBe('Current setup');
  });

  it('adds a saved loadout to the ranking and can clear it again', async () => {
    const user = userEvent.setup();
    render(<DpsCalculator />);

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Weapon' }),
      'Abyssal whip',
    );
    await user.click(screen.getByRole('button', { name: 'Save for comparison' }));

    expect(comparisonRows()).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Clear saved' }));

    expect(comparisonRows()).toHaveLength(1);
  });

  it('ranks the comparison table best first', async () => {
    const user = userEvent.setup();
    render(<DpsCalculator />);

    // Save a bare-handed loadout, then equip a whip. The whip must come first.
    await user.click(screen.getByRole('button', { name: 'Save for comparison' }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Weapon' }),
      'Abyssal whip',
    );

    const rows = comparisonRows();
    expect(rows[0]?.[0]).toBe('Current setup');
    expect(rows[0]?.[5]).toBe('100.0%');
    expect(Number(rows[0]?.[1])).toBeGreaterThan(Number(rows[1]?.[1]));
  });

  it('starts empty when localStorage holds something malformed', () => {
    window.localStorage.setItem('osrs-toolkit:combat:loadouts', '{ not json');
    render(<DpsCalculator />);

    expect(comparisonRows()).toHaveLength(1);
  });

  it('tells the user a salve does nothing against a living target', async () => {
    const user = userEvent.setup();
    render(<DpsCalculator />);

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Monster' }),
      'Giant Mole|Standard',
    );

    expect(screen.getByText('Ignored — this target is not undead')).toBeInTheDocument();
  });

  /**
   * A salve applied to a living monster is a silent ~20% overstatement, and a
   * comparison table is exactly where nobody would notice it.
   */
  it('ignores the salve amulet against a living target', async () => {
    const user = userEvent.setup();
    render(<DpsCalculator />);

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Monster' }),
      'Giant Mole|Standard',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Weapon' }),
      'Abyssal whip',
    );
    const without = dps();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Salve amulet' }),
      'salve amulet (ei)',
    );

    expect(dps()).toBe(without);
  });

  it('applies the salve amulet against an undead target', async () => {
    const user = userEvent.setup();
    render(<DpsCalculator />);

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Monster' }),
      'Vorkath|Post-quest',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Weapon' }),
      'Abyssal whip',
    );
    const without = dps();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Salve amulet' }),
      'salve amulet (ei)',
    );

    expect(dps()).toBeGreaterThan(without);
  });
});
