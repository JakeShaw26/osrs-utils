import { cn } from '@/lib/utils/cn';
import {
  hasItemIcon,
  itemIconSrc,
  ITEM_ICON_CELL,
  type ItemIconScale,
} from '@/lib/ui/item-icons';

/**
 * ATOM — one OSRS item icon, by item id.
 *
 * **This is the same tier as `Sprite`, not the same component.** Both are
 * fixed-palette illustrations that cannot be tinted and therefore can never
 * carry state through colour (ADR-0020). They are separate because the
 * rendering models do not meet: `Sprite` is SVG on a fixed 32 grid, so it scales
 * to any of 16/32/48/64; item icons are rasters trimmed to their content —
 * 18×29, 26×29, 32×31 — with no grid to scale against. Forcing them into
 * `Sprite`'s size union would stretch every icon by a different amount.
 *
 * So the *cell* is fixed and the artwork sits inside it at natural size. That is
 * also how the game lays them out, which is why a row of them looks right
 * despite the widths all differing.
 *
 * `slotted` reuses the inventory-slot tokens for the same reason `Sprite` does:
 * OSRS icons are outlined in near-black, which effectively vanishes on a dark
 * surface. On `surface-raised` in dark mode, slot them.
 *
 * ACCESSIBILITY. `name` becomes the alt text. Omit it only when a visible label
 * beside the icon already says the item name — then it is decorative and gets
 * `alt=""`, avoiding "Abyssal whip Abyssal whip".
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
  const known = hasItemIcon(id);

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center',
        slotted &&
          'rounded-control bg-sprite-slot ring-1 ring-sprite-slot-edge ring-inset',
        className,
      )}
      style={{ width: cell, height: cell }}
    >
      {known ? (
        /*
         * `next/image` is the wrong tool here, not merely unnecessary — it
         * resamples and re-encodes, which is precisely what destroys pixel art,
         * and `image-rendering: pixelated` cannot undo a resampled source. The
         * files are also ~400 bytes, smaller than the request headers asking
         * for them, and Vercel bills image optimisation per source image, so
         * 4,650 of them would cost real money to make worse. (ADR-0021)
         */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="item-icon"
          src={itemIconSrc(id)}
          alt={name ?? ''}
          /* Natural size, centred — the cell above reserves the space, so there
             is nothing to shift when the image lands and no dimensions to store.
             `scale(2)` doubles it without the layout knowing or caring. */
          style={scale === 1 ? undefined : { transform: `scale(${scale})` }}
          loading="lazy"
          decoding="async"
        />
      ) : (
        /* An id with no committed icon renders an empty cell, not a broken
           image. Untradeable ids reach us from drop tables and clue rewards,
           and the price mapping only covers tradeables — so this is an expected
           state, not an error. */
        <span aria-hidden="true" className="text-2xs text-content-subtle">
          ?
        </span>
      )}
    </span>
  );
}
