import { cn } from '@/lib/utils/cn';

/**
 * ATOM — UI chrome glyphs. The **second tier** of the two-tier icon system
 * ADR-0020 introduced.
 *
 * Where `ItemIcon` is Jagex's fixed-palette raster, these are single-path
 * `fill: currentColor` glyphs, so they follow the `content` tokens and invert
 * with the theme like any other text. That is the whole distinction: a glyph can
 * carry state through colour, item art cannot.
 *
 * Drawn on a 16×16 pixel grid — the game's grammar at half the resolution of an
 * item icon's cell — so the two tiers read as one family even though they behave
 * differently. `crispEdges` is the SVG counterpart of the `image-rendering:
 * pixelated` on `.item-icon`: without it the browser anti-aliases the staircase
 * and the pixel look is gone.
 *
 * **Never place a glyph beside an item icon at the same size.** A tinted glyph
 * next to fixed-palette art looks like a rendering bug rather than a choice.
 */

const PATHS = {
  search: (
    <>
      <path
        fillRule="evenodd"
        d="M4,1 H9 L12,4 V9 L9,12 H4 L1,9 V4 Z M5,3 H8 L10,5 V8 L8,10 H5 L3,8 V5 Z"
      />
      <path d="M10,10 H12 V12 H14 V14 H12 V12 H10 Z" />
    </>
  ),
  chevron: <path d="M2,5 H5 L8,8 L11,5 H14 L8,11 Z" />,
  close: (
    <path d="M2,4 L4,2 L8,6 L12,2 L14,4 L10,8 L14,12 L12,14 L8,10 L4,14 L2,12 L6,8 Z" />
  ),
  check: <path d="M2,8 L4,6 L7,9 L12,3 L14,5 L7,13 Z" />,
  info: (
    <>
      <path
        fillRule="evenodd"
        d="M5,1 H11 L15,5 V11 L11,15 H5 L1,11 V5 Z M6,3 H10 L13,6 V10 L10,13 H6 L3,10 V6 Z"
      />
      <path d="M7,3 H9 V5 H7 Z M7,6 H9 V13 H7 Z" />
    </>
  ),
  alert: (
    <>
      <path fillRule="evenodd" d="M8,1 L15,14 H1 Z M8,5 L12,12 H4 Z" />
      <path d="M7,6 H9 V10 H7 Z M7,11 H9 V13 H7 Z" />
    </>
  ),
  rise: <path d="M8,1 L14,8 H11 V15 H5 V8 H2 Z" />,
  fall: <path d="M8,15 L2,8 H5 V1 H11 V8 H14 Z" />,
  sort: <path d="M4,1 L7,5 H5 V15 H3 V5 H1 Z M12,15 L9,11 H11 V1 H13 V11 H15 Z" />,
  filter: <path d="M1,2 H15 L9,9 V15 L7,13 V9 Z" />,
  sun: (
    <>
      <path d="M7,0 H9 V3 H7 Z M7,13 H9 V16 H7 Z M0,7 H3 V9 H0 Z M13,7 H16 V9 H13 Z M2,3 L3,2 L5,4 L4,5 Z M11,12 L12,11 L14,13 L13,14 Z M13,2 L14,3 L12,5 L11,4 Z M4,11 L5,12 L3,14 L2,13 Z" />
      <path d="M6,4 H10 L12,6 V10 L10,12 H6 L4,10 V6 Z" />
    </>
  ),
  moon: (
    <path
      fillRule="evenodd"
      d="M6,1 H11 L14,4 V11 L11,14 H6 L2,11 V4 Z M10,-2 H17 V17 H10 L7,13 V2 Z"
    />
  ),
} as const;

export const ICON_NAMES = Object.keys(PATHS) as ReadonlyArray<IconName>;
export type IconName = keyof typeof PATHS;

interface IconProps {
  name: IconName;
  /** Pixel size. 16-grid, so multiples of 16 stay crisp; 20 and 24 are fine at this scale. */
  size?: number;
  /** The accessible name. Omit when a visible label beside it says the same word. */
  title?: string;
  className?: string;
}

export function Icon({ name, size = 16, title, className }: IconProps) {
  return (
    <svg
      className={cn('inline-block shrink-0 fill-current', className)}
      style={{ shapeRendering: 'crispEdges' }}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      {PATHS[name]}
    </svg>
  );
}
