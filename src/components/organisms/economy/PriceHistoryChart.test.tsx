import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TimeseriesPoint } from '@/lib/api/prices';
import { PRICE_RANGES, resolveRange } from '@/lib/economy/price-ranges';
import { PriceHistoryChart } from './PriceHistoryChart';

function point(
  timestamp: number,
  high: number | null,
  low: number | null,
): TimeseriesPoint {
  return {
    timestamp,
    avgHighPrice: high,
    avgLowPrice: low,
    highPriceVolume: 10,
    lowPriceVolume: 10,
  };
}

const RANGE = resolveRange('15d');

const SERIES = [
  point(1_784_000_000, 1_200_000, 1_100_000),
  point(1_784_003_600, 1_250_000, 1_120_000),
  point(1_784_007_200, 1_180_000, 1_090_000),
];

/**
 * The geometry is tested as pure logic in lib/economy/chart.test.ts. This
 * covers what the geometry cannot: that the SVG is described to assistive tech,
 * that both series are identified without relying on colour, and that an item
 * with no history says so instead of rendering an empty box.
 */
describe('PriceHistoryChart', () => {
  it('states the empty case instead of rendering a blank chart', () => {
    render(<PriceHistoryChart points={[]} range={RANGE} itemName="Twisted bow" />);

    expect(screen.getByText(/no price history for twisted bow/i)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('suggests a longer range when a thin item has no data', () => {
    render(<PriceHistoryChart points={[]} range={RANGE} itemName="Twisted bow" />);

    expect(screen.getByText(/try a longer range/i)).toBeInTheDocument();
  });

  it('describes the chart for a screen reader, including the price range', () => {
    render(<PriceHistoryChart points={SERIES} range={RANGE} itemName="Twisted bow" />);

    const chart = screen.getByRole('img', { name: /twisted bow price history/i });
    // formatGp truncates towards zero, so 1,090,000 reads as "1m".
    expect(chart).toHaveAccessibleName(/ranged from 1m to 1\.2m gp/i);
  });

  // Identity must never rest on colour alone — a legend is always present for
  // two series.
  it('names both series in a legend', () => {
    render(<PriceHistoryChart points={SERIES} range={RANGE} itemName="Twisted bow" />);

    expect(screen.getByText(/sell price/i)).toBeInTheDocument();
    expect(screen.getByText(/buy price/i)).toBeInTheDocument();
  });

  it('explains what the shaded band means', () => {
    render(<PriceHistoryChart points={SERIES} range={RANGE} itemName="Twisted bow" />);

    expect(screen.getByText(/shaded gap = margin/i)).toBeInTheDocument();
  });

  it('states the granularity and point count so the range is not misread', () => {
    render(<PriceHistoryChart points={SERIES} range={RANGE} itemName="Twisted bow" />);

    expect(screen.getByText(/one point per hour/i)).toBeInTheDocument();
    expect(screen.getByText(/3 points/i)).toBeInTheDocument();
  });

  it('renders each of the four ranges with its own granularity label', () => {
    for (const range of PRICE_RANGES) {
      const { unmount } = render(
        <PriceHistoryChart points={SERIES} range={range} itemName="Item" />,
      );

      expect(
        screen.getByText(new RegExp(`one point per ${range.pointDescription}`, 'i')),
      ).toBeInTheDocument();

      unmount();
    }
  });

  it('renders a series that has gaps without failing', () => {
    const withGaps = [
      point(1_784_000_000, 1_200_000, 1_100_000),
      point(1_784_003_600, null, null),
      point(1_784_007_200, 1_180_000, 1_090_000),
    ];

    render(<PriceHistoryChart points={withGaps} range={RANGE} itemName="Twisted bow" />);

    expect(screen.getByRole('img', { name: /twisted bow/i })).toBeInTheDocument();
  });
});
