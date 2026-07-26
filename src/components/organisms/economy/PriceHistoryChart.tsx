import type { TimeseriesPoint } from '@/lib/api/prices';
import { buildPriceChartGeometry } from '@/lib/economy/chart';
import type { PriceRange } from '@/lib/economy/price-ranges';
import { formatGp } from '@/lib/utils/format-gp';

/**
 * ORGANISM — price history as inline SVG.
 *
 * Hand-rolled rather than added as a dependency. This is one line chart over at
 * most 365 points; a charting library would be the single largest thing in the
 * bundle, and all of the fiddly parts (nice axis steps, gap handling, label
 * collision) live in `lib/economy/chart.ts` as pure functions with tests. This
 * file only maps geometry onto elements.
 *
 * STILL A SERVER COMPONENT. Tooltips come from native SVG `<title>` on
 * invisible hit columns rather than a JS hover layer, so the chart costs zero
 * kilobytes of JavaScript, works before hydration, and is readable by assistive
 * tech without any ARIA of our own.
 *
 * TWO SERIES ON ONE AXIS, never two axes: both are prices in gp, so they share
 * a scale honestly. The shaded band between them is the flipping margin, which
 * is the thing this whole feature is about.
 *
 * Colour: `primary` (warm) and `info` (cool). Validated for colour-blind
 * separation rather than eyeballed — worst-case ΔE 27 protan / 24.7 tritan,
 * well clear of the 8 threshold. Identity is also carried by the legend and the
 * end labels, so no reading depends on colour alone.
 */

interface PriceHistoryChartProps {
  points: readonly TimeseriesPoint[];
  range: PriceRange;
  itemName: string;
}

/** Dates only — the 5m range spans two days, so a time would be more useful, but
 *  a fixed format keeps the axis width predictable and the tooltip carries detail. */
function formatChartDate(timestampSeconds: number): string {
  return new Date(timestampSeconds * 1000).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

function formatChartDateTime(timestampSeconds: number): string {
  return new Date(timestampSeconds * 1000).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

export function PriceHistoryChart({ points, range, itemName }: PriceHistoryChartProps) {
  const geometry = buildPriceChartGeometry(points, {
    formatValue: (value) => `${formatGp(value)} gp`,
    formatDate: formatChartDate,
    formatTooltipDate: formatChartDateTime,
  });

  if (!geometry.hasData) {
    return (
      <div className="rounded-card border border-border bg-surface-sunken px-4 py-12 text-center">
        <p className="text-sm text-content-muted">
          No price history for {itemName} over the last {range.label}.
        </p>
        <p className="mt-1 text-xs text-content-subtle">
          Items that rarely trade have gaps in the Wiki&rsquo;s feed. Try a longer range.
        </p>
      </div>
    );
  }

  const { width, height } = geometry;

  return (
    <figure className="m-0">
      {/* Legend above the plot. Always present for two series — identity must
          never rest on colour alone (docs/theming.md, dataviz rules). */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-content-muted">
        <span className="inline-flex items-center gap-1.5">
          <svg width="14" height="4" aria-hidden focusable="false">
            <rect width="14" height="3" rx="1.5" fill="var(--color-primary)" />
          </svg>
          Sell price (instant-buy)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="14" height="4" aria-hidden focusable="false">
            <rect width="14" height="3" rx="1.5" fill="var(--color-info)" />
          </svg>
          Buy price (instant-sell)
        </span>
        <span className="text-content-subtle">Shaded gap = margin</span>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height={height}
          role="img"
          aria-label={`${itemName} price history over the last ${range.label}. Instant-buy ranged from ${formatGp(geometry.minValue)} to ${formatGp(geometry.maxValue)} gp.`}
          className="min-w-[20rem]"
        >
          {/* Gridlines: solid hairlines one step off the surface, never dashed. */}
          <g>
            {geometry.gridLines.map((line) => (
              <g key={line.value}>
                <line
                  x1={0}
                  x2={width}
                  y1={line.y}
                  y2={line.y}
                  stroke="var(--color-border)"
                  strokeWidth={1}
                />
                <text
                  x={2}
                  y={line.y - 3}
                  className="tabular"
                  fontSize={10}
                  fill="var(--color-content-subtle)"
                >
                  {formatGp(line.value)}
                </text>
              </g>
            ))}
          </g>

          {/* The margin band. A wash, not a saturated block. */}
          {geometry.bandPath ? (
            <path d={geometry.bandPath} fill="var(--color-primary)" fillOpacity={0.1} />
          ) : null}

          {/* 2px lines, round join and cap. */}
          <path
            d={geometry.lowPath}
            fill="none"
            stroke="var(--color-info)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d={geometry.highPath}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Selective direct labels — the endpoints only, and dropped entirely
              when the two lines converge (see chart.ts). Text wears a text
              token, never the series colour. */}
          {geometry.endLabels.map((label) => (
            <text
              key={label.series}
              x={label.x - 4}
              y={label.series === 'high' ? label.y - 6 : label.y + 12}
              textAnchor="end"
              className="tabular"
              fontSize={11}
              fontWeight={600}
              fill="var(--color-content)"
            >
              {label.text}
            </text>
          ))}

          {/* X axis. */}
          {geometry.xLabels.map((label, index) => (
            <text
              key={`${label.label}-${label.x}`}
              x={label.x}
              y={height - 6}
              // Anchor the outer ticks inward so neither overflows the viewBox.
              textAnchor={
                index === 0
                  ? 'start'
                  : index === geometry.xLabels.length - 1
                    ? 'end'
                    : 'middle'
              }
              fontSize={10}
              fill="var(--color-content-subtle)"
            >
              {label.label}
            </text>
          ))}

          {/* Invisible hover columns. Native tooltips, no JavaScript. */}
          <g>
            {geometry.hitAreas.map((area) => (
              <rect
                key={area.x}
                x={area.x}
                y={0}
                width={area.width}
                height={height}
                fill="transparent"
              >
                <title>{area.tooltip}</title>
              </rect>
            ))}
          </g>
        </svg>
      </div>

      <figcaption className="mt-2 text-xs text-content-subtle">
        One point per {range.pointDescription} · {points.length} points · OSRS Wiki
        real-time prices
      </figcaption>
    </figure>
  );
}
