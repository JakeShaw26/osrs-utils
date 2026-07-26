import type { TimeseriesPoint } from '@/lib/api/prices';

/**
 * Price-chart geometry — every number the SVG needs, computed as pure data.
 *
 * No chart library is installed and none is being added: this is a line chart
 * over at most 365 points, and a charting dependency would cost more bundle
 * than the entire rest of the feature. The trade is that the geometry has to be
 * written by hand — so it is written HERE, as pure functions, where axis
 * rounding and label collisions can be unit-tested without rendering anything.
 * The component that consumes this only maps the output onto `<path>` elements.
 *
 * Two series, deliberately: instant-buy and instant-sell. The gap between them
 * IS the flipping margin, so plotting both makes the chart answer the question
 * the rest of this feature is about, rather than showing an averaged "price"
 * that no player can actually transact at.
 */

export interface ChartSeriesPoint {
  x: number;
  y: number;
}

export interface ChartGridLine {
  y: number;
  value: number;
}

export interface ChartXLabel {
  x: number;
  label: string;
}

export interface ChartHitArea {
  x: number;
  width: number;
  /** Native `<title>` text — a tooltip with no JavaScript. */
  tooltip: string;
}

export interface ChartEndLabel {
  x: number;
  y: number;
  text: string;
  series: 'high' | 'low';
}

export interface PriceChartGeometry {
  width: number;
  height: number;
  /** Empty string when a series has no usable points. */
  highPath: string;
  lowPath: string;
  /** Closed region between the two lines — the visible margin. */
  bandPath: string;
  gridLines: readonly ChartGridLine[];
  xLabels: readonly ChartXLabel[];
  hitAreas: readonly ChartHitArea[];
  /** Empty when the two lines converge and labels would overlap. */
  endLabels: readonly ChartEndLabel[];
  minValue: number;
  maxValue: number;
  /** False when there is nothing plottable — the caller renders an empty state. */
  hasData: boolean;
}

export interface ChartOptions {
  width?: number;
  height?: number;
  /** Space reserved for axis labels. */
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  /** Approximate number of horizontal gridlines. Actual count follows the nice-number step. */
  targetGridLines?: number;
  /** Injected so tests are timezone-stable rather than dependent on the runner's locale. */
  formatValue?: (value: number) => string;
  /** Axis ticks. Kept short — three of these share the chart's width. */
  formatDate?: (timestampSeconds: number) => string;
  /**
   * Tooltips. Defaults to `formatDate`, but the two want different precision:
   * an axis tick has room for "3 Jul" and a tooltip should say which hour.
   */
  formatTooltipDate?: (timestampSeconds: number) => string;
}

const DEFAULTS = {
  width: 720,
  height: 260,
  paddingLeft: 8,
  paddingRight: 8,
  paddingTop: 12,
  paddingBottom: 22,
  targetGridLines: 4,
} as const;

/**
 * Vertical distance, in px, below which two end labels are considered to
 * collide. Roughly one line of small text — nudging them apart instead would
 * detach each label from its line, which reads as noise.
 */
const END_LABEL_MIN_GAP = 14;

/**
 * Rounds an axis step up to 1, 2, 2.5 or 5 times a power of ten.
 *
 * Axis ticks must land on numbers a human reads as round — 0 / 50k / 100k, not
 * 0 / 47,312 / 94,624. Exported because it is the single most fiddly piece of
 * arithmetic here and deserves its own tests.
 */
export function niceStep(rawStep: number): number {
  if (!Number.isFinite(rawStep) || rawStep <= 0) return 1;

  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalised = rawStep / magnitude;

  const nice =
    normalised <= 1
      ? 1
      : normalised <= 2
        ? 2
        : normalised <= 2.5
          ? 2.5
          : normalised <= 5
            ? 5
            : 10;

  return nice * magnitude;
}

/** `null` prices are gaps in the feed, not zeroes — drop them, never plot them as 0. */
function usableValues(points: readonly TimeseriesPoint[]): number[] {
  const values: number[] = [];
  for (const point of points) {
    if (typeof point.avgHighPrice === 'number' && point.avgHighPrice > 0) {
      values.push(point.avgHighPrice);
    }
    if (typeof point.avgLowPrice === 'number' && point.avgLowPrice > 0) {
      values.push(point.avgLowPrice);
    }
  }
  return values;
}

/**
 * Builds an SVG path across one series, skipping null blocks.
 *
 * A gap becomes a `M` (move) rather than an `L` (line), so a period with no
 * trades shows as a break instead of a straight line implying prices that were
 * never quoted.
 */
function buildPath(
  points: readonly TimeseriesPoint[],
  pick: (point: TimeseriesPoint) => number | null,
  toX: (index: number) => number,
  toY: (value: number) => number,
): { path: string; last: ChartSeriesPoint | null } {
  let path = '';
  let penDown = false;
  let last: ChartSeriesPoint | null = null;

  points.forEach((point, index) => {
    const value = pick(point);
    if (typeof value !== 'number' || value <= 0) {
      penDown = false;
      return;
    }

    const x = toX(index);
    const y = toY(value);
    path += `${penDown ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
    penDown = true;
    last = { x, y };
  });

  return { path, last };
}

export function buildPriceChartGeometry(
  points: readonly TimeseriesPoint[],
  options: ChartOptions = {},
): PriceChartGeometry {
  const width = options.width ?? DEFAULTS.width;
  const height = options.height ?? DEFAULTS.height;
  const paddingLeft = options.paddingLeft ?? DEFAULTS.paddingLeft;
  const paddingRight = options.paddingRight ?? DEFAULTS.paddingRight;
  const paddingTop = options.paddingTop ?? DEFAULTS.paddingTop;
  const paddingBottom = options.paddingBottom ?? DEFAULTS.paddingBottom;
  const targetGridLines = options.targetGridLines ?? DEFAULTS.targetGridLines;
  const formatValue = options.formatValue ?? ((value: number) => String(value));
  const formatDate =
    options.formatDate ??
    ((timestamp: number) => new Date(timestamp * 1000).toISOString().slice(0, 10));
  const formatTooltipDate = options.formatTooltipDate ?? formatDate;

  const plotWidth = Math.max(1, width - paddingLeft - paddingRight);
  const plotHeight = Math.max(1, height - paddingTop - paddingBottom);

  const values = usableValues(points);

  const empty: PriceChartGeometry = {
    width,
    height,
    highPath: '',
    lowPath: '',
    bandPath: '',
    gridLines: [],
    xLabels: [],
    hitAreas: [],
    endLabels: [],
    minValue: 0,
    maxValue: 0,
    hasData: false,
  };

  if (values.length === 0) return empty;

  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);

  // A flat series has zero range, which would divide by zero. Give it a nominal
  // band so the line renders through the middle instead of vanishing.
  const rawRange = dataMax - dataMin;
  const range = rawRange > 0 ? rawRange : Math.max(1, dataMax * 0.1);

  const step = niceStep(range / Math.max(1, targetGridLines));
  const axisMin = Math.floor(dataMin / step) * step;
  const axisMax = Math.ceil((rawRange > 0 ? dataMax : dataMin + range) / step) * step;
  const axisRange = axisMax - axisMin || 1;

  const toX = (index: number) =>
    points.length <= 1
      ? paddingLeft + plotWidth / 2
      : paddingLeft + (index / (points.length - 1)) * plotWidth;

  const toY = (value: number) =>
    paddingTop + plotHeight - ((value - axisMin) / axisRange) * plotHeight;

  const high = buildPath(points, (p) => p.avgHighPrice, toX, toY);
  const low = buildPath(points, (p) => p.avgLowPrice, toX, toY);

  /* --- The band between the two lines ------------------------------------ */
  // Only spans blocks where BOTH sides are quoted; a one-sided block has no
  // margin to show, and interpolating across it would invent one.
  const bandTop: string[] = [];
  const bandBottom: string[] = [];
  for (const [index, point] of points.entries()) {
    const h = point.avgHighPrice;
    const l = point.avgLowPrice;
    if (typeof h !== 'number' || h <= 0 || typeof l !== 'number' || l <= 0) continue;
    const x = toX(index).toFixed(1);
    bandTop.push(`${x} ${toY(h).toFixed(1)}`);
    bandBottom.push(`${x} ${toY(l).toFixed(1)}`);
  }

  const bandPath =
    bandTop.length > 1 ? `M${bandTop.join('L')}L${bandBottom.reverse().join('L')}Z` : '';

  /* --- Gridlines --------------------------------------------------------- */
  const gridLines: ChartGridLine[] = [];
  for (let value = axisMin; value <= axisMax + step / 2; value += step) {
    gridLines.push({ y: toY(value), value });
  }

  /* --- X labels ---------------------------------------------------------- */
  // Three: start, middle, end. More collide at this width on a phone.
  const xLabels: ChartXLabel[] = [];
  if (points.length > 0) {
    const indices =
      points.length === 1
        ? [0]
        : [0, Math.floor((points.length - 1) / 2), points.length - 1];
    for (const index of indices) {
      const point = points[index];
      if (!point) continue;
      xLabels.push({ x: toX(index), label: formatDate(point.timestamp) });
    }
  }

  /* --- Hover targets ----------------------------------------------------- */
  // One invisible column per point carrying a native <title>. This is how the
  // chart gets tooltips with zero JavaScript and stays a server component —
  // and unlike a custom tooltip it is reachable by assistive tech for free.
  const columnWidth = plotWidth / Math.max(1, points.length);
  const hitAreas: ChartHitArea[] = points.map((point, index) => {
    const parts = [formatTooltipDate(point.timestamp)];
    if (typeof point.avgHighPrice === 'number' && point.avgHighPrice > 0) {
      parts.push(`Sell ${formatValue(point.avgHighPrice)}`);
    }
    if (typeof point.avgLowPrice === 'number' && point.avgLowPrice > 0) {
      parts.push(`Buy ${formatValue(point.avgLowPrice)}`);
    }
    return {
      x: paddingLeft + index * columnWidth,
      width: columnWidth,
      tooltip: parts.join(' · '),
    };
  });

  /* --- End labels -------------------------------------------------------- */
  const endLabels: ChartEndLabel[] = [];
  const highEnd = high.last as ChartSeriesPoint | null;
  const lowEnd = low.last as ChartSeriesPoint | null;

  // Both labels, or neither. When the lines converge the two values overlap
  // into unreadable mush, and the legend already carries identity — so the
  // honest fallback is to drop them rather than nudge them apart.
  if (highEnd && lowEnd && Math.abs(highEnd.y - lowEnd.y) >= END_LABEL_MIN_GAP) {
    // `findLast` is ES2023 and this project targets ES2022, so walk backwards.
    const lastValue = (
      pick: (point: TimeseriesPoint) => number | null,
    ): number | null => {
      for (let index = points.length - 1; index >= 0; index -= 1) {
        const point = points[index];
        if (!point) continue;
        const value = pick(point);
        if (typeof value === 'number' && value > 0) return value;
      }
      return null;
    };

    const lastHigh = lastValue((p) => p.avgHighPrice);
    const lastLow = lastValue((p) => p.avgLowPrice);

    if (lastHigh !== null) {
      endLabels.push({
        x: highEnd.x,
        y: highEnd.y,
        text: formatValue(lastHigh),
        series: 'high',
      });
    }
    if (lastLow !== null) {
      endLabels.push({
        x: lowEnd.x,
        y: lowEnd.y,
        text: formatValue(lastLow),
        series: 'low',
      });
    }
  }

  return {
    width,
    height,
    highPath: high.path,
    lowPath: low.path,
    bandPath,
    gridLines,
    xLabels,
    hitAreas,
    endLabels,
    minValue: dataMin,
    maxValue: dataMax,
    hasData: true,
  };
}
