/**
 * The feature sprite vocabulary (ADR-0020).
 *
 * Lives in `lib/` rather than beside the artwork because both the component
 * that draws sprites and the plain data that names them need it, and `lib/`
 * is the layer both may import. `SpriteSheet.tsx` owns the pixels; this file
 * owns the names, so a sprite referenced by data and a sprite drawn in the
 * sheet cannot drift apart without a test noticing.
 */

export const SPRITE_NAMES = [
  'coins',
  'scimitar',
  'anvil',
  'clue',
  'star',
  'shield',
  'hourglass',
] as const;

export type SpriteName = (typeof SPRITE_NAMES)[number];

/** The `id` a `<use href>` points at. One definition, so the two cannot drift. */
export function spriteId(name: SpriteName): string {
  return `osrs-sprite-${name}`;
}
