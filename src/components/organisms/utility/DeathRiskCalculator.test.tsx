import type { ComponentProps } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeathRiskCalculator } from './DeathRiskCalculator';
import type { PricedItem } from '@/lib/utility/death-risk';

/**
 * Prices arrive as a prop, so no network stub is needed here at all — which is
 * the point of fetching in the route rather than the component. The rules
 * themselves are covered in death-risk.test.ts; these tests only assert that
 * the component shows what it is handed.
 */
const CATALOGUE: PricedItem[] = [
  { id: '1', name: 'Twisted bow', unitValue: 1_200_000_000 },
  { id: '2', name: 'Avernic defender', unitValue: 60_000_000 },
  { id: '3', name: 'Primordial boots', unitValue: 30_000_000 },
  { id: '4', name: 'Amulet of fury', unitValue: 3_000_000 },
];

function setup(props: Partial<ComponentProps<typeof DeathRiskCalculator>> = {}) {
  const user = userEvent.setup();
  render(<DeathRiskCalculator catalogue={CATALOGUE} {...props} />);
  return user;
}

async function addItem(user: ReturnType<typeof userEvent.setup>, id: string) {
  await user.selectOptions(screen.getByRole('combobox', { name: 'Common gear' }), id);
  await user.click(screen.getByRole('button', { name: 'Add item' }));
}

function summary() {
  return screen.getByRole('group', { name: 'Death risk summary' });
}

/**
 * Fate badges, scoped to the table.
 *
 * The summary block also carries a "Kept" heading, so an unscoped
 * `getAllByText('Kept')` counts one row too many — the kind of off-by-one a
 * scoped query removes rather than papers over with a magic number.
 */
function fates(fate: 'Kept' | 'Lost') {
  return within(screen.getByRole('table')).queryAllByText(fate);
}

describe('DeathRiskCalculator', () => {
  it('states the empty case rather than showing a blank table', () => {
    setup();

    expect(
      screen.getByText(/Nothing added yet — an empty inventory risks nothing/),
    ).toBeInTheDocument();
  });

  it('starts by keeping three items', () => {
    setup();

    expect(screen.getByText(/Keeping/)).toHaveTextContent('Keeping 3 items.');
  });

  it('marks items as kept until the limit is passed', async () => {
    const user = setup();

    for (const id of ['1', '2', '3']) await addItem(user, id);
    expect(fates('Kept')).toHaveLength(3);
    expect(fates('Lost')).toHaveLength(0);

    await addItem(user, '4');
    expect(fates('Kept')).toHaveLength(3);
    expect(fates('Lost')).toHaveLength(1);
  });

  it('protects a fourth item with Protect Item', async () => {
    const user = setup();

    for (const id of ['1', '2', '3', '4']) await addItem(user, id);
    await user.click(screen.getByRole('checkbox', { name: 'Protect Item active' }));

    expect(fates('Kept')).toHaveLength(4);
    expect(within(summary()).getByText('0')).toBeInTheDocument();
  });

  it('risks everything when skulled', async () => {
    const user = setup();

    for (const id of ['1', '2']) await addItem(user, id);
    await user.click(screen.getByRole('checkbox', { name: 'Skulled' }));

    expect(screen.getByText(/Keeping/)).toHaveTextContent('Keeping 0 items.');
    expect(fates('Lost')).toHaveLength(2);
    expect(within(summary()).getAllByText('1.2b').length).toBeGreaterThan(0);
  });

  it('keeps exactly one item when skulled with Protect Item', async () => {
    const user = setup();

    for (const id of ['1', '2']) await addItem(user, id);
    await user.click(screen.getByRole('checkbox', { name: 'Skulled' }));
    await user.click(screen.getByRole('checkbox', { name: 'Protect Item active' }));

    expect(screen.getByText(/Keeping/)).toHaveTextContent('Keeping 1 item.');
    expect(fates('Kept')).toHaveLength(1);
  });

  it('multiplies a quantity into the risk', async () => {
    const user = setup();

    await addItem(user, '4');
    await user.click(screen.getByRole('checkbox', { name: 'Skulled' }));

    const quantity = screen.getByRole('textbox', { name: 'Quantity of Amulet of fury' });
    await user.clear(quantity);
    await user.type(quantity, '10');

    // 10 × 3m, formatted the way the game writes it.
    expect(within(summary()).getAllByText('30m').length).toBeGreaterThan(0);
  });

  it('removes an item', async () => {
    const user = setup();

    await addItem(user, '1');
    await user.click(screen.getByRole('button', { name: 'Remove Twisted bow' }));

    expect(
      screen.getByText(/Nothing added yet — an empty inventory risks nothing/),
    ).toBeInTheDocument();
  });

  describe('custom items', () => {
    it('accepts the shorthand people actually type', async () => {
      const user = setup();

      await user.type(
        screen.getByRole('textbox', { name: 'Other item' }),
        'Blighted anglerfish',
      );
      await user.type(screen.getByRole('textbox', { name: 'Value each' }), '1.5m');
      await user.click(screen.getByRole('button', { name: 'Add custom' }));

      expect(screen.getByText('Blighted anglerfish')).toBeInTheDocument();
      expect(screen.getAllByText('1.5m').length).toBeGreaterThan(0);
    });

    // The failure this guards: `Number('abc')` is NaN, and "NaN gp" reaching
    // the screen is the bug docs/testing.md calls out by name.
    it('refuses an unparseable value instead of rendering NaN', async () => {
      const user = setup();

      await user.type(screen.getByRole('textbox', { name: 'Other item' }), 'Mystery box');
      await user.type(screen.getByRole('textbox', { name: 'Value each' }), 'lots');

      expect(screen.getByRole('alert')).toHaveTextContent(/Enter a number/);
      expect(screen.getByRole('button', { name: 'Add custom' })).toBeDisabled();
      expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    });

    it('clears the error once the value becomes valid', async () => {
      const user = setup();

      const value = screen.getByRole('textbox', { name: 'Value each' });
      await user.type(value, 'x');
      expect(screen.getByRole('alert')).toBeInTheDocument();

      await user.clear(value);
      await user.type(value, '5000');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('when live prices are unavailable', () => {
    it('says so and still allows manual entry', async () => {
      const user = userEvent.setup();
      render(
        <DeathRiskCalculator
          catalogue={[]}
          pricesError="Live prices unavailable: no environment."
        />,
      );

      expect(screen.getByText(/Live prices unavailable/)).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'Common gear' })).toBeDisabled();

      await user.type(
        screen.getByRole('textbox', { name: 'Other item' }),
        'Rune platebody',
      );
      await user.type(screen.getByRole('textbox', { name: 'Value each' }), '38k');
      await user.click(screen.getByRole('button', { name: 'Add custom' }));

      expect(screen.getByText('Rune platebody')).toBeInTheDocument();
    });
  });
});
