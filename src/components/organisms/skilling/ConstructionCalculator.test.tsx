import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConstructionCalculator } from './ConstructionCalculator';
import type { ConstructionBuild, ItemPrices } from '@/lib/skilling/types';

const BUILDS: ConstructionBuild[] = [
  {
    id: 'oak-larder',
    name: 'Oak larder',
    room: 'Kitchen',
    minLevel: 33,
    xpPerBuild: 480,
    materials: [{ item: 'Oak plank', quantity: 8 }],
    xpPerHour: 480_000,
  },
  {
    id: 'mystery-build',
    name: 'Mystery build',
    room: 'Kitchen',
    minLevel: 90,
    xpPerBuild: 1000,
    materials: [{ item: 'Mystery plank', quantity: 2 }],
    xpPerHour: 500_000,
  },
];

const PRICES: ItemPrices = { 'oak plank': 500, 'mystery plank': null };

function renderCalculator(pricesUnavailable = false) {
  return render(
    <ConstructionCalculator
      builds={BUILDS}
      prices={PRICES}
      pricesUnavailable={pricesUnavailable}
    />,
  );
}

describe('ConstructionCalculator', () => {
  it('prompts for a goal before producing a shopping list', () => {
    renderCalculator();

    expect(
      screen.getByText(/enter your current xp and a target level/i),
    ).toBeInTheDocument();
  });

  it('turns an XP goal into a priced material list', async () => {
    const user = userEvent.setup();
    renderCalculator();

    await user.type(
      screen.getByRole('textbox', { name: 'Current Construction XP' }),
      '12554431',
    );

    // 480,000 XP remaining = 1,000 larders = 8,000 oak planks at 500 gp.
    const materialRow = screen.getByRole('row', { name: /Oak plank/ });
    expect(within(materialRow).getByText('8,000')).toBeInTheDocument();
    expect(within(materialRow).getByText('4m')).toBeInTheDocument();
  });

  it('rounds the build count up', async () => {
    const user = userEvent.setup();
    renderCalculator();

    // 481 XP remaining is 1.002 builds -> 2.
    await user.type(
      screen.getByRole('textbox', { name: 'Current Construction XP' }),
      '13033950',
    );

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  /**
   * Quantities are still correct with no price. A shopping list you can take to
   * the Grand Exchange is most of the value here, so it must survive the prices
   * being unavailable.
   */
  it('keeps quantities and blanks only the costs when a price is missing', async () => {
    const user = userEvent.setup();
    renderCalculator();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Build' }),
      'mystery-build',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Current Construction XP' }),
      '13032431',
    );

    const materialRow = screen.getByRole('row', { name: /Mystery plank/ });
    expect(within(materialRow).getByText('4')).toBeInTheDocument(); // 2 builds * 2
    expect(within(materialRow).getByText('no price')).toBeInTheDocument();
  });

  it('states when live prices are unavailable altogether', () => {
    renderCalculator(true);

    expect(screen.getByRole('status')).toHaveTextContent(/prices are unavailable/i);
  });

  it('warns when the build is above the level the XP implies, without hiding it', async () => {
    const user = userEvent.setup();
    renderCalculator();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Build' }),
      'mystery-build',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Current Construction XP' }),
      '1000',
    );

    expect(screen.getByRole('status')).toHaveTextContent(/needs level 90/i);
    // Still costed — Construction levels are boostable.
    expect(screen.getByRole('row', { name: /Mystery plank/ })).toBeInTheDocument();
  });

  it('accepts shorthand and thousands separators', async () => {
    const user = userEvent.setup();
    renderCalculator();

    await user.type(
      screen.getByRole('textbox', { name: 'Current Construction XP' }),
      '12,554,431',
    );

    expect(screen.getByText('8,000')).toBeInTheDocument();
    expect(screen.queryByText(/nan/i)).not.toBeInTheDocument();
  });

  it('shows an error and no NaN for unreadable input', async () => {
    const user = userEvent.setup();
    renderCalculator();

    await user.type(
      screen.getByRole('textbox', { name: 'Current Construction XP' }),
      'lots',
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/enter a number/i);
    expect(screen.queryByText(/nan/i)).not.toBeInTheDocument();
  });

  it('flags a target level below the current XP', async () => {
    const user = userEvent.setup();
    renderCalculator();

    await user.type(
      screen.getByRole('textbox', { name: 'Current Construction XP' }),
      '13m',
    );
    await user.clear(screen.getByRole('textbox', { name: 'Target level' }));
    await user.type(screen.getByRole('textbox', { name: 'Target level' }), '50');

    expect(screen.getByRole('alert')).toHaveTextContent(/below your current xp/i);
  });
});
