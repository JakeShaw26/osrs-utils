import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrainingMethodComparator } from './TrainingMethodComparator';
import type { ItemPrices, TrainingMethod } from '@/lib/skilling/types';

const SOURCE = {
  title: 'OSRS Wiki: Test guide',
  url: 'https://oldschool.runescape.wiki/w/Test',
  retrieved: '2026-07-26',
  basis: 'wiki-guide' as const,
};

const METHODS: TrainingMethod[] = [
  {
    id: 'cheap',
    skill: 'Fletching',
    name: 'Cheap method',
    minLevel: 55,
    xpPerAction: 100,
    xpPerHour: 100_000,
    inputs: [{ item: 'Widget', quantity: 1 }],
    outputs: [],
    source: SOURCE,
  },
  {
    id: 'unpriced',
    skill: 'Fletching',
    name: 'Unpriced method',
    minLevel: 70,
    xpPerAction: 200,
    xpPerHour: 400_000,
    inputs: [{ item: 'Mystery item', quantity: 1 }],
    outputs: [],
    source: SOURCE,
  },
];

const PRICES: ItemPrices = { widget: 500, 'mystery item': null };

function renderComparator(
  overrides: Partial<React.ComponentProps<typeof TrainingMethodComparator>> = {},
) {
  return render(
    <TrainingMethodComparator
      methods={METHODS}
      prices={PRICES}
      pricesUnavailable={false}
      {...overrides}
    />,
  );
}

function row(name: string | RegExp) {
  return screen.getByRole('row', { name });
}

describe('TrainingMethodComparator', () => {
  it('lists the methods for the selected skill', () => {
    renderComparator();

    expect(screen.getByText('Cheap method')).toBeInTheDocument();
    expect(screen.getByText('Unpriced method')).toBeInTheDocument();
  });

  it('prompts for a goal before showing totals', () => {
    renderComparator();

    expect(
      screen.getByText(/enter your current xp and a target level/i),
    ).toBeInTheDocument();
  });

  it('shows gp/xp from the live prices it was handed', () => {
    renderComparator();

    // 500 gp of inputs for 100 XP.
    expect(within(row(/Cheap method/)).getByText('5.00')).toBeInTheDocument();
  });

  /**
   * A cost that silently omits an ingredient looks like a bargain. The unpriced
   * item is named in the row instead.
   */
  it('names the unpriced item rather than costing it at zero', () => {
    renderComparator();

    const target = row(/Unpriced method/);
    expect(within(target).getByText(/no price for: mystery item/i)).toBeInTheDocument();
    // Both the gp/xp and total-gp cells go blank — neither is guessed at.
    expect(within(target).getAllByText('—')).toHaveLength(2);
  });

  it('states when live prices are unavailable altogether', () => {
    renderComparator({ pricesUnavailable: true });

    expect(screen.getByRole('status')).toHaveTextContent(/prices are unavailable/i);
  });

  it('computes actions, hours and total gp once a goal is entered', async () => {
    const user = userEvent.setup();
    renderComparator();

    await user.type(screen.getByRole('textbox', { name: 'Current XP' }), '13034331');

    // 100 XP left: 1 action of 100, 1 hour rate is irrelevant at this scale.
    const target = row(/Cheap method/);
    expect(within(target).getByText('1')).toBeInTheDocument();
  });

  /**
   * THE POINT OF THE FEATURE (PRD §3.3). A member who disagrees with a rate
   * edits it and gets their own answer, instead of filing a bug report.
   */
  it('recalculates from a user-edited xp/hr', async () => {
    const user = userEvent.setup();
    renderComparator();

    await user.type(screen.getByRole('textbox', { name: 'Current XP' }), '12034431');
    // 1,000,000 XP remaining at the authored 100,000/hr is 10.0 hours.
    expect(within(row(/Cheap method/)).getByText('10.0')).toBeInTheDocument();

    await user.type(
      screen.getByRole('textbox', { name: 'XP per hour for Cheap method' }),
      '250000',
    );

    // The same goal at the user's own rate is 4.0 hours.
    expect(within(row(/Cheap method/)).getByText('4.0')).toBeInTheDocument();
  });

  it('accepts shorthand in the rate override', async () => {
    const user = userEvent.setup();
    renderComparator();

    await user.type(screen.getByRole('textbox', { name: 'Current XP' }), '12034431');
    await user.type(
      screen.getByRole('textbox', { name: 'XP per hour for Cheap method' }),
      '250k',
    );

    expect(within(row(/Cheap method/)).getByText('4.0')).toBeInTheDocument();
  });

  it('ignores a rate override that is not a usable number', async () => {
    const user = userEvent.setup();
    renderComparator();

    await user.type(screen.getByRole('textbox', { name: 'Current XP' }), '12034431');
    await user.type(
      screen.getByRole('textbox', { name: 'XP per hour for Cheap method' }),
      'fast',
    );

    // Falls back to the authored rate rather than rendering NaN.
    expect(within(row(/Cheap method/)).getByText('10.0')).toBeInTheDocument();
    expect(screen.queryByText(/nan/i)).not.toBeInTheDocument();
  });

  it('offers a reset once a rate has been edited, and restores the authored value', async () => {
    const user = userEvent.setup();
    renderComparator();

    await user.type(screen.getByRole('textbox', { name: 'Current XP' }), '12034431');
    await user.type(
      screen.getByRole('textbox', { name: 'XP per hour for Cheap method' }),
      '250000',
    );

    await user.click(screen.getByRole('button', { name: /reset rates/i }));

    expect(within(row(/Cheap method/)).getByText('10.0')).toBeInTheDocument();
  });

  /**
   * PRD §3.3 requires authored rates to cite their origin, "otherwise every
   * disagreement about rates becomes a bug report".
   */
  it('links the source of every rate', () => {
    renderComparator();

    const links = screen.getAllByRole('link', { name: /test guide/i });
    expect(links).toHaveLength(METHODS.length);
    expect(links[0]).toHaveAttribute('href', SOURCE.url);
  });

  it('reorders when the sort is changed', async () => {
    const user = userEvent.setup();
    renderComparator();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Sort by' }),
      'fastest',
    );

    const names = screen
      .getAllByRole('row')
      .slice(1)
      .map((tr) => tr.textContent ?? '');
    expect(names[0]).toContain('Unpriced method'); // 400,000/hr
  });

  it('shows an error and no NaN when the current XP is not a number', async () => {
    const user = userEvent.setup();
    renderComparator();

    await user.type(screen.getByRole('textbox', { name: 'Current XP' }), 'heaps');

    expect(screen.getByRole('alert')).toHaveTextContent(/enter a number/i);
    expect(screen.queryByText(/nan/i)).not.toBeInTheDocument();
  });

  it('flags a target level below the current XP', async () => {
    const user = userEvent.setup();
    renderComparator();

    await user.type(screen.getByRole('textbox', { name: 'Current XP' }), '13m');
    await user.clear(screen.getByRole('textbox', { name: 'Target level' }));
    await user.type(screen.getByRole('textbox', { name: 'Target level' }), '50');

    expect(screen.getByRole('alert')).toHaveTextContent(/below your current xp/i);
  });

  it('states an empty table rather than rendering nothing', () => {
    render(
      <TrainingMethodComparator methods={[]} prices={{}} pricesUnavailable={false} />,
    );

    expect(screen.getByText(/no authored methods/i)).toBeInTheDocument();
  });
});
