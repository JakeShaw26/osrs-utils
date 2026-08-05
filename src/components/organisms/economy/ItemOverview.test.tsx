import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { MarketRow } from '@/lib/economy/market';
import { ItemOverview } from './ItemOverview';

/**
 * `Crystal 2h axe` — in the price mapping, so this route serves it, but the
 * icon file the mapping names 404s, so it is one of the five ids with no packed
 * artwork. A reachable URL rather than a synthetic id.
 */
const NO_ARTWORK = 28_220;

/**
 * Reads one stat tile by its label. Several tiles can legitimately show the
 * same text — "capped at 5m" appears on both the margin and the tax tile — so
 * pairing the `<dt>` with its `<dd>` asserts the right tile carries the value.
 */
function statValue(label: string): string {
  const term = screen.getByText(label);
  return term.nextElementSibling?.textContent?.trim() ?? '';
}

/** The hint line sits after the value, so it is the dt's second sibling. */
function statHint(label: string): string {
  const term = screen.getByText(label);
  return term.nextElementSibling?.nextElementSibling?.textContent?.trim() ?? '';
}

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
    lastTradedAt: Math.floor(Date.now() / 1000) - 120,
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

describe('ItemOverview', () => {
  it('shows both sides of the book with the margin after tax', () => {
    render(<ItemOverview row={row()} natureRunePrice={100} />);

    expect(statValue('Buy price')).toBe('1.5m gp');
    expect(statValue('Sell price')).toBe('1.6m gp');
    // 100,000 gross - 32,000 tax = 68,000
    expect(statValue('Margin after tax')).toBe('68k gp');
  });

  it('surfaces the buy limit as a per-4-hour figure', () => {
    render(<ItemOverview row={row()} natureRunePrice={100} />);

    expect(statValue('Buy limit')).toBe('70');
    expect(statHint('Buy limit')).toBe('per 4 hours');
  });

  it('says "None" when an item has no buy limit', () => {
    render(<ItemOverview row={row({ buyLimit: null })} natureRunePrice={100} />);

    expect(statValue('Buy limit')).toBe('None');
  });

  // Alching a whip is a heavy loss, and the tool must say so.
  it('shows a negative alch profit rather than hiding it', () => {
    render(<ItemOverview row={row()} natureRunePrice={100} />);

    // 72,000 alch - 1,500,000 buy - 100 nature = -1,428,100
    expect(statValue('Alch profit / cast')).toBe('-1.4m gp');
  });

  it('marks an unalchable item instead of showing a zero value', () => {
    render(<ItemOverview row={row({ highAlch: null })} natureRunePrice={100} />);

    expect(statValue('High alch value')).toBe('Unalchable');
  });

  it('says the nature rune price is unavailable rather than assuming free', () => {
    render(<ItemOverview row={row()} natureRunePrice={null} />);

    expect(statHint('Alch profit / cast')).toMatch(/nature rune price unavailable/i);
  });

  it('flags a members item', () => {
    render(<ItemOverview row={row()} natureRunePrice={100} />);

    expect(screen.getByText('Members')).toBeInTheDocument();
  });

  it('flags a tax-exempt item and charges it no tax', () => {
    render(
      <ItemOverview
        row={row({ name: 'Lobster', buyPrice: 100, sellPrice: 200, highAlch: null })}
        natureRunePrice={100}
      />,
    );

    expect(screen.getByText('Tax exempt')).toBeInTheDocument();
    expect(statValue('GE tax')).toBe('Exempt');
    // Full 100gp margin, no tax deducted.
    expect(statValue('Margin after tax')).toBe('100 gp');
  });

  it('does not claim a margin for an item priced on only one side', () => {
    render(<ItemOverview row={row({ sellPrice: null })} natureRunePrice={100} />);

    expect(statValue('Margin after tax')).toBe('—');
    expect(statHint('Margin after tax')).toMatch(/needs prices on both sides/i);
  });

  it('always states liquidity', () => {
    render(<ItemOverview row={row({ fiveMinute: null })} natureRunePrice={100} />);

    expect(screen.getByText('No volume data')).toBeInTheDocument();
  });

  it("shows the item's artwork at double scale in the header", () => {
    const { container } = render(<ItemOverview row={row()} natureRunePrice={100} />);

    expect(container.querySelector('.item-icon')).toHaveStyle({
      transform: 'scale(2)',
    });
  });

  // The heading beside it is the item name.
  it('keeps the artwork decorative', () => {
    render(<ItemOverview row={row()} natureRunePrice={100} />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  /** Five mapping ids have no packed artwork. The header must still be a header. */
  it('renders the header for an item with no artwork', () => {
    const { container } = render(
      <ItemOverview
        row={row({ id: NO_ARTWORK, name: 'Crystal 2h axe' })}
        natureRunePrice={100}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Crystal 2h axe' })).toBeInTheDocument();
    expect(container.querySelector('.item-icon')).toBeNull();
  });

  it('notes that a large sale is capped rather than taxed at 2%', () => {
    render(
      <ItemOverview
        row={row({ buyPrice: 1_000_000_000, sellPrice: 1_400_000_000 })}
        natureRunePrice={100}
      />,
    );

    // 2% of 1.4b would be 28m; the cap holds the tax at 5m.
    expect(statHint('Margin after tax')).toMatch(/capped at 5m/i);
    expect(statValue('Margin after tax')).toBe('395m gp');
  });
});
