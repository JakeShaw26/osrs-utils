/**
 * Item icon lookup (ADR-0021 for the artwork, ADR-0022 for how it is delivered).
 *
 * Split from `item-icons.generated.ts` so a regeneration overwrites one file and
 * leaves the other alone: the generated half is a machine-written list nobody
 * should edit, and this half is the vocabulary the app reasons in.
 */

import {
  ATLAS_CELL,
  ATLAS_COLUMNS,
  ATLAS_SHARD_CAPACITY,
  ATLAS_SHARDS,
  ITEM_ICON_IDS,
} from './item-icons.generated';

/**
 * Built once at module load rather than searched per call. A table of 200 rows
 * would otherwise do 200 linear scans of a 4,600-element array — and we need
 * the index, not just membership, so this replaces what was a Set.
 */
const INDEX = new Map<number, number>(ITEM_ICON_IDS.map((id, i) => [id, i]));

/**
 * The in-game inventory cell. Icons are trimmed to their content and vary
 * (18×29 through 36×32), so the cell — not the artwork — is what makes a row of
 * them line up. Re-exported from the generated side deliberately: the packer
 * cuts the sheets on this grid, so a constant here that disagreed with the one
 * there would offset every icon by a few pixels and still look like art.
 */
export const ITEM_ICON_CELL = ATLAS_CELL;

/**
 * Integer only, and deliberately not a free number. These are rasters: at 1.5×
 * nearest-neighbour gives some source pixels two device pixels and others one,
 * which reads as a wobble rather than as a bigger icon.
 */
export type ItemIconScale = 1 | 2;

/** Where one item's artwork sits: which sheet, and where on it. */
export interface ItemIconPosition {
  /** Same-origin path to the sheet — never an upstream URL. */
  src: string;
  /** Pixel offset of the cell from the sheet's top-left. */
  x: number;
  y: number;
}

export function hasItemIcon(id: number): boolean {
  return INDEX.has(id);
}

/**
 * `null` for an id with no packed icon — an expected state, not an error.
 * Untradeable ids reach us from drop tables and clue rewards, and the price
 * mapping the generator reads only covers tradeables.
 *
 * The path is same-origin static. Pointing this at the wiki would hotlink their
 * bandwidth on every page view, which docs/api-terms.md §2 rule 7 rules out.
 */
export function itemIconPosition(id: number): ItemIconPosition | null {
  const index = INDEX.get(id);
  if (index === undefined) return null;

  const slot = index % ATLAS_SHARD_CAPACITY;

  return {
    src: `/item-icons/${ATLAS_SHARDS[Math.floor(index / ATLAS_SHARD_CAPACITY)]}`,
    x: (slot % ATLAS_COLUMNS) * ATLAS_CELL,
    y: Math.floor(slot / ATLAS_COLUMNS) * ATLAS_CELL,
  };
}

export { ITEM_ICON_IDS, ATLAS_SHARDS };
