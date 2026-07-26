import { describe, expect, it } from 'vitest';
import type { TimeseriesPoint } from '@/lib/api/prices';
import { buildPriceChartGeometry, niceStep } from './chart';

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

describe('niceStep', () => {
  it('rounds up to 1, 2, 2.5 or 5 times a power of ten', () => {
    expect(niceStep(1)).toBe(1);
    expect(niceStep(1.5)).toBe(2);
    expect(niceStep(2.2)).toBe(2.5);
    expect(niceStep(3)).toBe(5);
    expect(niceStep(7)).toBe(10);
  });

  it('scales across magnitudes', () => {
    expect(niceStep(47_312)).toBe(50_000);
    expect(niceStep(0.03)).toBe(0.05);
    expect(niceStep(1_800_000)).toBe(2_000_000);
  });

  it('never returns zero or a negative step', () => {
    expect(niceStep(0)).toBe(1);
    expect(niceStep(-5)).toBe(1);
    expect(niceStep(Number.NaN)).toBe(1);
  });
});

describe('buildPriceChartGeometry', () => {
  const series = [
    point(1_000, 120, 100),
    point(2_000, 140, 110),
    point(3_000, 130, 105),
    point(4_000, 160, 120),
  ];

  it('reports no data for an empty series', () => {
    const geometry = buildPriceChartGeometry([]);

    expect(geometry.hasData).toBe(false);
    expect(geometry.highPath).toBe('');
    expect(geometry.gridLines).toEqual([]);
  });

  // A block with no trades reports null, not zero. Plotting it as zero would
  // draw a cliff to the bottom of the chart that never happened.
  it('reports no data when every point is null', () => {
    const geometry = buildPriceChartGeometry([
      point(1_000, null, null),
      point(2_000, null, null),
    ]);

    expect(geometry.hasData).toBe(false);
  });

  it('builds a path per series and spans the full width', () => {
    const geometry = buildPriceChartGeometry(series, { width: 100, height: 50 });

    expect(geometry.hasData).toBe(true);
    expect(geometry.highPath).toMatch(/^M/);
    expect(geometry.lowPath).toMatch(/^M/);
    // Four points => four path commands per series.
    expect(geometry.highPath.match(/[ML]/g)).toHaveLength(4);
  });

  it('reports the true data range, not the padded axis range', () => {
    const geometry = buildPriceChartGeometry(series);

    expect(geometry.minValue).toBe(100);
    expect(geometry.maxValue).toBe(160);
  });

  // The gap-handling case: a null block must break the line, not interpolate
  // across it, or the chart shows prices that were never quoted.
  it('breaks the line at a gap instead of drawing through it', () => {
    const withGap = [
      point(1_000, 120, 100),
      point(2_000, null, null),
      point(3_000, 130, 105),
    ];

    const geometry = buildPriceChartGeometry(withGap);

    // Two separate segments => two move commands.
    expect(geometry.highPath.match(/M/g)).toHaveLength(2);
  });

  it('places gridlines on round numbers', () => {
    const geometry = buildPriceChartGeometry(series, { targetGridLines: 4 });

    for (const line of geometry.gridLines) {
      expect(Number.isInteger(line.value)).toBe(true);
    }
    expect(geometry.gridLines.length).toBeGreaterThan(1);
  });

  // A flat series has zero range, which would divide by zero and collapse the
  // chart. It should still render a line.
  it('renders a flat series without dividing by zero', () => {
    const flat = [point(1_000, 100, 100), point(2_000, 100, 100)];

    const geometry = buildPriceChartGeometry(flat);

    expect(geometry.hasData).toBe(true);
    expect(geometry.highPath).not.toBe('');
    for (const line of geometry.gridLines) {
      expect(Number.isFinite(line.y)).toBe(true);
    }
  });

  it('handles a single point without dividing by zero', () => {
    const geometry = buildPriceChartGeometry([point(1_000, 120, 100)]);

    expect(geometry.hasData).toBe(true);
    expect(geometry.xLabels).toHaveLength(1);
  });

  it('gives every point a hover target carrying both prices', () => {
    const geometry = buildPriceChartGeometry(series, {
      formatValue: (value) => `${value}gp`,
      formatTooltipDate: () => 'DATE',
    });

    expect(geometry.hitAreas).toHaveLength(4);
    expect(geometry.hitAreas[0]?.tooltip).toBe('DATE · Sell 120gp · Buy 100gp');
  });

  it('omits a missing side from the tooltip rather than showing zero', () => {
    const geometry = buildPriceChartGeometry([point(1_000, 120, null)], {
      formatValue: (value) => `${value}gp`,
      formatTooltipDate: () => 'DATE',
    });

    expect(geometry.hitAreas[0]?.tooltip).toBe('DATE · Sell 120gp');
  });

  it('labels three x positions on a long series', () => {
    const geometry = buildPriceChartGeometry(series, { formatDate: (t) => `t${t}` });

    expect(geometry.xLabels.map((label) => label.label)).toEqual([
      't1000',
      't2000',
      't4000',
    ]);
  });

  it('labels both line endpoints when they are well separated', () => {
    const geometry = buildPriceChartGeometry(series, {
      height: 400,
      formatValue: (value) => `${value}`,
    });

    expect(geometry.endLabels.map((label) => label.series).sort()).toEqual([
      'high',
      'low',
    ]);
    expect(geometry.endLabels.find((l) => l.series === 'high')?.text).toBe('160');
  });

  // Nudging converged labels apart detaches them from their lines and reads as
  // noise. The legend already carries identity, so dropping them is honest.
  it('drops both end labels when the two lines converge', () => {
    const converged = [point(1_000, 100, 99), point(2_000, 100, 100)];

    const geometry = buildPriceChartGeometry(converged, { height: 60 });

    expect(geometry.endLabels).toEqual([]);
  });

  it('only draws the margin band where both sides are quoted', () => {
    const oneSided = [point(1_000, 120, null), point(2_000, 130, null)];

    expect(buildPriceChartGeometry(oneSided).bandPath).toBe('');
    expect(buildPriceChartGeometry(series).bandPath).not.toBe('');
  });

  // 365 is the upstream cap, so it is the realistic worst case for label and
  // hit-area density.
  it('handles a full 365-point series', () => {
    const full = Array.from({ length: 365 }, (_, index) =>
      point(index * 86_400, 1_000 + index, 900 + index),
    );

    const geometry = buildPriceChartGeometry(full);

    expect(geometry.hasData).toBe(true);
    expect(geometry.hitAreas).toHaveLength(365);
    expect(geometry.xLabels).toHaveLength(3);
  });
});
