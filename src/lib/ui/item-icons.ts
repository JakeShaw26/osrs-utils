/**
 * Item icon lookup (ADR-0021).
 *
 * Split from `item-icons.generated.ts` for the same reason `sprites.ts` is split
 * from `SpriteSheet.tsx`: the generated half is a machine-written list nobody
 * should edit, and the hand-written half is the vocabulary the app reasons in.
 * A regeneration overwrites one and leaves the other alone.
 */

import { ITEM_ICON_IDS } from './item-icons.generated';

/**
 * Built once at module load rather than searched per call. A table of 200 rows
 * would otherwise do 200 linear scans of a 4,600-element array.
 */
const AVAILABLE = new Set<number>(ITEM_ICON_IDS);

/**
 * The in-game inventory cell. Icons are trimmed to their content and vary
 * (18×29 through 32×31 observed), so the cell — not the artwork — is what makes
 * a row of them line up. Anything smaller clips the widest items.
 */
export const ITEM_ICON_CELL = 36;

/**
 * Integer only, and deliberately not a free number. These are raster sprites:
 * at 1.5× nearest-neighbour gives some source pixels two device pixels and
 * others one, which reads as a wobble rather than as a bigger sprite. `Sprite`
 * refuses `size={24}` for the same underlying reason.
 */
export type ItemIconScale = 1 | 2;

export function hasItemIcon(id: number): boolean {
  return AVAILABLE.has(id);
}

/**
 * A same-origin static path — never an upstream URL. Pointing an `<img>` at the
 * wiki would hotlink their bandwidth on every page view, which
 * docs/api-terms.md §2 rule 7 rules out.
 *
 * ⚠️ The file this points at is gitignored, so it resolves only where the
 * generator has run. Delivery is unresolved — ADR-0021.
 */
export function itemIconSrc(id: number): string {
  return `/item-icons/${id}.png`;
}

export { ITEM_ICON_IDS };
