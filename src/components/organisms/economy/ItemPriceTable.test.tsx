import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ItemPriceTable } from './ItemPriceTable';
import { itemIconPosition } from '@/lib/ui/item-icons';
import type { MarketRow } from '@/lib/economy/market';

/**
 * `Crystal 2h axe` — in the price mapping, so it reaches this table, but the
 * icon file the mapping names 404s. One of only five such ids.
 */
const NO_ARTWORK = 28_220;

function row(overrides: Partial<MarketRow> = {}): MarketRow {
  return {
    id: 4151,
    name: 'Abyssal whip',
    examine: 'A weapon from the abyss.',
    members: true,
    icon: 'whip.png',
    buyLimit: 70,
    highAlch: 72_000,
    buyPrice: 1_500_000,
    sellPrice: 1_600_000,
    lastTradedAt: 1_784_912_264,
    recentVolume: 240,
    fiveMinute: {
      avgHighPrice: 1_600_000,
      avgLowPrice: 1_500_000,
      highPriceVolume: 120,
      lowPriceVolume: 120,
    },
    ...overrides,
  };
}

describe('ItemPriceTable', () => {
  it('states the empty case rather than rendering a bare table', () => {
    render(<ItemPriceTable rows={[]} emptyMessage="No item matches “xyzzy”." />);

    expect(screen.getByText('No item matches “xyzzy”.')).toBeInTheDocument();
  });

  it('renders prices and links each item to its detail page', () => {
    render(<ItemPriceTable rows={[row()]} emptyMessage="none" />);

    const link = screen.getByRole('link', { name: 'Abyssal whip' });
    expect(link).toHaveAttribute('href', '/economy/items/4151');
    expect(screen.getByText('1.5m')).toBeInTheDocument();
    expect(screen.getByText('1.6m')).toBeInTheDocument();
  });

  // The margin column must be net of tax; showing the gross figure is the
  // defect this whole feature is trying to avoid.
  it('shows the margin after GE tax, not the gross margin', () => {
    render(<ItemPriceTable rows={[row()]} emptyMessage="none" />);

    // Gross is 100,000. Tax on a 1.6m sale is 32,000, so net is 68,000.
    expect(screen.getByText('68k')).toBeInTheDocument();
    expect(screen.queryByText('100k')).not.toBeInTheDocument();
  });

  it('shows the buy limit and alch value', () => {
    render(<ItemPriceTable rows={[row()]} emptyMessage="none" />);

    expect(screen.getByText('70')).toBeInTheDocument();
    expect(screen.getByText('72k')).toBeInTheDocument();
  });

  it('shows a dash rather than zero for an item that has never traded', () => {
    render(
      <ItemPriceTable
        rows={[row({ buyPrice: null, sellPrice: null, buyLimit: null, highAlch: null })]}
        emptyMessage="none"
      />,
    );

    const cells = screen.getAllByRole('cell');
    const dashes = cells.filter((cell) => cell.textContent === '—');

    expect(dashes.length).toBeGreaterThanOrEqual(4);
    expect(screen.queryByText('NaN')).not.toBeInTheDocument();
  });

  it('carries a liquidity badge on every row', () => {
    render(
      <ItemPriceTable
        rows={[
          row({ id: 1, name: 'Busy item' }),
          row({
            id: 2,
            name: 'Dead item',
            fiveMinute: {
              avgHighPrice: 1,
              avgLowPrice: 1,
              highPriceVolume: 0,
              lowPriceVolume: 0,
            },
          }),
        ]}
        emptyMessage="none"
      />,
    );

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Illiquid')).toBeInTheDocument();
  });

  it('marks an item with no volume data rather than implying it is active', () => {
    render(<ItemPriceTable rows={[row({ fiveMinute: null })]} emptyMessage="none" />);

    expect(screen.getByText('No volume data')).toBeInTheDocument();
  });

  /**
   * The cell offset is the whole mechanism — wrong coordinates render a
   * different item's art, which looks deliberate rather than broken. Pinning it
   * to the row's id is what stops the icon column drifting off the data.
   */
  it("renders the row's artwork from the id the row already carries", () => {
    const { container } = render(<ItemPriceTable rows={[row()]} emptyMessage="none" />);
    const position = itemIconPosition(4151)!;

    expect(container.querySelector('.item-icon')).toHaveStyle({
      backgroundPosition: `-${position.x}px -${position.y}px`,
    });
  });

  // The link beside the icon already prints the name; a named icon would make a
  // screen reader read "Abyssal whip Abyssal whip" on every row.
  it('keeps the artwork decorative rather than announcing the name twice', () => {
    render(<ItemPriceTable rows={[row()]} emptyMessage="none" />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getAllByText('Abyssal whip')).toHaveLength(1);
  });

  // Rare here — the table is fed from the same mapping the packer reads — but a
  // gap must degrade to an empty slot rather than dropping the row.
  it('still renders the row for an item with no artwork', () => {
    render(
      <ItemPriceTable
        rows={[row({ id: NO_ARTWORK, name: 'Crystal 2h axe' })]}
        emptyMessage="none"
      />,
    );

    expect(screen.getByRole('link', { name: 'Crystal 2h axe' })).toHaveAttribute(
      'href',
      `/economy/items/${NO_ARTWORK}`,
    );
    expect(screen.getByText('1.5m')).toBeInTheDocument();
  });

  it('gives the table an accessible caption and column headers', () => {
    render(<ItemPriceTable rows={[row()]} emptyMessage="none" />);

    const table = screen.getByRole('table', { name: /live grand exchange prices/i });
    expect(
      within(table).getByRole('columnheader', { name: 'Margin' }),
    ).toBeInTheDocument();
  });
});
