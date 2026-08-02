import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { rankAlchOpportunities, type AlchCandidate } from '@/lib/economy/alch';
import { hasItemIcon } from '@/lib/ui/item-icons';
import { AlchProfitTable } from './AlchProfitTable';

const CANDIDATES: AlchCandidate[] = [
  {
    id: 1,
    name: 'Rare with a tiny limit',
    highAlch: 100_000,
    buyPrice: 50_000,
    buyLimit: 8,
    recentVolume: 50,
  },
  {
    id: 2,
    name: 'Bulk staple',
    highAlch: 1_000,
    buyPrice: 700,
    buyLimit: 13_000,
    recentVolume: 5_000,
  },
];

describe('AlchProfitTable', () => {
  it('states the empty case', () => {
    render(
      <AlchProfitTable opportunities={[]} emptyMessage="Nothing is profitable today." />,
    );

    expect(screen.getByText('Nothing is profitable today.')).toBeInTheDocument();
  });

  it('links each item to its price page', () => {
    const opportunities = rankAlchOpportunities(CANDIDATES, 100);
    render(<AlchProfitTable opportunities={opportunities} emptyMessage="none" />);

    expect(screen.getByRole('link', { name: 'Bulk staple' })).toHaveAttribute(
      'href',
      '/economy/items/2',
    );
  });

  // The ordering IS the product decision here: the item with the huge per-cast
  // profit must not be top when its buy limit makes it unreachable.
  it('lists the highest gp/hour first, not the highest gp/cast', () => {
    const opportunities = rankAlchOpportunities(CANDIDATES, 100);
    render(<AlchProfitTable opportunities={opportunities} emptyMessage="none" />);

    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveAccessibleName('Bulk staple');
    expect(links[1]).toHaveAccessibleName('Rare with a tiny limit');
  });

  it('marks rows where the buy limit, not casting speed, caps the hourly figure', () => {
    const opportunities = rankAlchOpportunities(CANDIDATES, 100);
    render(<AlchProfitTable opportunities={opportunities} emptyMessage="none" />);

    // Only the tiny-limit item is capped by resupply.
    expect(screen.getAllByText('Limited')).toHaveLength(1);
  });

  it('shows the sustainable cast rate, not the theoretical one', () => {
    const opportunities = rankAlchOpportunities(CANDIDATES, 100);
    render(<AlchProfitTable opportunities={opportunities} emptyMessage="none" />);

    // 8 per 4 hours = 2 casts an hour.
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1,200')).toBeInTheDocument();
  });

  it('says "None" for an item with no buy limit', () => {
    const opportunities = rankAlchOpportunities(
      [{ ...CANDIDATES[1]!, buyLimit: null }],
      100,
    );
    render(<AlchProfitTable opportunities={opportunities} emptyMessage="none" />);

    expect(screen.getByText('None')).toBeInTheDocument();
  });

  /**
   * One icon per row, whether or not the id has artwork — id 1 is not a
   * tradeable and so is absent from the manifest, which makes this fixture a
   * free test of both states at once. A row that silently lost its cell would
   * misalign the icon column against the rest of the table.
   */
  it('gives every row an icon cell, including ids with no artwork', () => {
    expect(hasItemIcon(1)).toBe(false);
    expect(hasItemIcon(2)).toBe(true);

    const { container } = render(
      <AlchProfitTable
        opportunities={rankAlchOpportunities(CANDIDATES, 100)}
        emptyMessage="none"
      />,
    );

    // Two rows, one drawn cell: the missing one still reserves its slot.
    expect(container.querySelectorAll('.item-icon')).toHaveLength(1);
    expect(screen.getAllByRole('row')).toHaveLength(3); // header + 2
  });

  // The link beside each icon prints the same name.
  it('keeps the artwork decorative', () => {
    render(
      <AlchProfitTable
        opportunities={rankAlchOpportunities(CANDIDATES, 100)}
        emptyMessage="none"
      />,
    );

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('names its columns', () => {
    render(<AlchProfitTable opportunities={[]} emptyMessage="none" />);

    expect(screen.getByRole('columnheader', { name: 'Profit / hr' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Buy limit' })).toBeInTheDocument();
  });
});
