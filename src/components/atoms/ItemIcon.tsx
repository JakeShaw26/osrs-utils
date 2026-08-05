import { cn } from '@/lib/utils/cn';
import {
  itemIconPosition,
  ITEM_ICON_CELL,
  type ItemIconScale,
} from '@/lib/ui/item-icons';

/**
 * ATOM — one OSRS item icon, by item id.
 *
 * **This is tier one of the two-tier icon system** (ADR-0020) — fixed-palette
 * art that cannot be tinted and can therefore never carry state through colour.
 * `Icon` is tier two: `currentColor` glyphs that behave like text.
 *
 * Item icons are rasters **trimmed to their content** — 18×29, 26×29, 36×32 —
 * with no grid to scale against, so the *cell* is fixed and the artwork sits
 * inside it. That is also how the game lays them out, which is why a row of them
 * looks right despite the widths all differing. (The hand-drawn `Sprite` this
 * replaced was SVG on a fixed 32 grid; it was removed once the tool groups moved
 * to real item art. `git show 77e990f` has it.)
 *
 * **Why a background offset and not an `<img>` (ADR-0022).** The icons ship as
 * ten packed sheets rather than 4,646 files, so there is no per-item URL to
 * point an `<img>` at — the cell is addressed by offset into a sheet. This also
 * makes a table of 200 items one request instead of 200. The centring that
 * flexbox used to do is baked into the sheet at pack time, at integer offsets.
 *
 * `slotted` floats the icon in an inventory slot: OSRS icons are outlined in
 * near-black, roughly 1.1:1 against a near-black surface, so the silhouette
 * dissolves without it. On `surface-raised` in dark mode, slot them.
 *
 * ACCESSIBILITY. `name` becomes the accessible name. Omit it when a visible
 * label beside the icon already says the item name — then it is decorative and
 * announces nothing, avoiding "Abyssal whip Abyssal whip".
 */

interface ItemIconProps {
  /** OSRS item id, as used by the GE price feeds. */
  id: number;
  /** The item name. Omit only when a visible label repeats it. */
  name?: string;
  /** Integer multiples only — see `ItemIconScale`. */
  scale?: ItemIconScale;
  /** Float the icon in an inventory slot — needed on dark surfaces. */
  slotted?: boolean;
  className?: string;
}

export function ItemIcon({ id, name, scale = 1, slotted, className }: ItemIconProps) {
  const cell = ITEM_ICON_CELL * scale;
  const position = itemIconPosition(id);

  return (
    <span
      /* Only artwork gets announced as an image. An id we have no icon for
         renders an empty cell, and calling that "Abyssal whip, image" would
         describe something the user cannot see. */
      role={position && name ? 'img' : undefined}
      aria-label={position && name ? name : undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center',
        slotted &&
          'rounded-control bg-sprite-slot ring-1 ring-sprite-slot-edge ring-inset',
        className,
      )}
      style={{ width: cell, height: cell }}
    >
      {position ? (
        <span
          className="item-icon"
          style={{
            width: ITEM_ICON_CELL,
            height: ITEM_ICON_CELL,
            backgroundImage: `url(${position.src})`,
            backgroundPosition: `-${position.x}px -${position.y}px`,
            /* The cell stays at its natural size and is scaled up, rather than
               scaling the sheet and recomputing offsets against it — one number
               to get wrong instead of three, and `scale(2)` on nearest-neighbour
               art doubles pixels exactly. */
            ...(scale === 1 ? null : { transform: `scale(${scale})` }),
          }}
        />
      ) : (
        /* Untradeable ids reach us from drop tables and clue rewards, and the
           price mapping only covers tradeables — so this is an expected state,
           not an error. */
        <span aria-hidden="true" className="text-2xs text-content-subtle">
          ?
        </span>
      )}
    </span>
  );
}
