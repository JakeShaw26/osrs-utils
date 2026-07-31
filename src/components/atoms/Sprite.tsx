import { cn } from '@/lib/utils/cn';
import { spriteId, type SpriteName } from '@/lib/ui/sprites';

/**
 * ATOM — one feature sprite, drawn from the sheet in the root layout.
 *
 * **A sprite is an illustration, not an icon.** It has a fixed palette, is
 * byte-identical in both themes, and cannot be tinted — so it can never carry
 * state (disabled, active, danger) through colour. State belongs on the
 * container. For anything that must follow `content` / `content-muted`, use
 * `Icon` instead, and never put the two side by side at the same size: a tinted
 * glyph next to a fixed-palette sprite reads as a rendering bug.
 *
 * SIZE IS A UNION, NOT A NUMBER. A 32-grid sprite is crisp at 16/32/48/64 and
 * soft at anything else, because fractional device pixels blur the staircase.
 * **24 is the size habit reaches for**, which is exactly why the type refuses it
 * rather than trusting discipline.
 *
 * `slotted` floats the sprite in an inventory slot. That is not decoration: the
 * outline is `#1b1206`, which on a near-black dark surface is about 1.1:1, so
 * the silhouette dissolves and the sprite frays into loose colour. The slot is
 * both the contrast fix and the game's own device, so it reads as intent.
 *
 * ACCESSIBILITY. A sprite that carries meaning gets a `title`, which becomes its
 * accessible name. Omit `title` only when a visible label beside it already says
 * the same word — then it is decorative and hidden, avoiding a double
 * announcement.
 */

/** 16/32/48/64 only — see the note above on why 24 is deliberately absent. */
export type SpriteSize = 16 | 32 | 48 | 64;

/** Slot padding per size, so the tile keeps the sprite's proportions. */
const SLOT_PADDING: Record<SpriteSize, string> = {
  16: 'p-1',
  32: 'p-1.5',
  48: 'p-2',
  64: 'p-2.5',
};

interface SpriteProps {
  name: SpriteName;
  size?: SpriteSize;
  /** The accessible name. Omit only when a visible label repeats it. */
  title?: string;
  /** Float the sprite in an inventory slot — required on dark surfaces. */
  slotted?: boolean;
  className?: string;
}

export function Sprite({ name, size = 32, title, slotted, className }: SpriteProps) {
  const svg = (
    <svg
      className="sprite"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <use href={`#${spriteId(name)}`} />
    </svg>
  );

  if (!slotted) {
    return <span className={cn('inline-flex', className)}>{svg}</span>;
  }

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-control',
        'bg-sprite-slot ring-1 ring-sprite-slot-edge ring-inset',
        SLOT_PADDING[size],
        className,
      )}
    >
      {svg}
    </span>
  );
}
