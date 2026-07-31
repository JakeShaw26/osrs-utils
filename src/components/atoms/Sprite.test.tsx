import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Sprite } from './Sprite';
import { SpriteSheet } from './SpriteSheet';
import { SPRITE_NAMES, spriteId } from '@/lib/ui/sprites';

describe('Sprite', () => {
  it('names itself for assistive tech when it carries meaning', () => {
    render(<Sprite name="coins" title="Economy" />);

    expect(screen.getByRole('img', { name: 'Economy' })).toBeInTheDocument();
  });

  /**
   * A sprite beside a visible label that says the same word must be hidden, or
   * a screen reader announces "Economy Economy".
   */
  it('is hidden when it has no title, rather than announced as unlabelled', () => {
    const { container } = render(<Sprite name="coins" />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('points at the sheet rather than inlining the artwork', () => {
    const { container } = render(<Sprite name="anvil" />);

    // The whole point of the sheet: one copy of the pixels, N references.
    expect(container.querySelector('use')).toHaveAttribute(
      'href',
      `#${spriteId('anvil')}`,
    );
    expect(container.querySelectorAll('path')).toHaveLength(0);
  });

  /**
   * Without crispEdges the browser anti-aliases the staircase and it stops
   * being pixel art — the one property the whole look depends on.
   */
  it('renders with the sprite class that disables anti-aliasing', () => {
    const { container } = render(<Sprite name="star" />);

    expect(container.querySelector('svg')).toHaveClass('sprite');
  });

  it('renders at the requested integer size', () => {
    const { container } = render(<Sprite name="star" size={48} />);
    const svg = container.querySelector('svg');

    expect(svg).toHaveAttribute('width', '48');
    expect(svg).toHaveAttribute('height', '48');
    // The 32-grid viewBox is what makes 16/32/48/64 land on whole pixels.
    expect(svg).toHaveAttribute('viewBox', '0 0 32 32');
  });

  it('wraps a slotted sprite in an inventory slot', () => {
    const { container } = render(<Sprite name="shield" slotted />);

    // The slot is the dark-mode contrast fix: the #1b1206 outline is ~1.1:1 on
    // a near-black surface, so the silhouette needs a lighter ground.
    expect(container.firstElementChild).toHaveClass('bg-sprite-slot');
  });

  it('does not wrap an unslotted sprite', () => {
    const { container } = render(<Sprite name="shield" />);

    expect(container.firstElementChild).not.toHaveClass('bg-sprite-slot');
  });
});

describe('sprite sheet', () => {
  it('defines artwork for every name in the vocabulary', () => {
    const { container } = render(<SpriteSheet />);

    // Guards the drift that types cannot: `SpriteName` accepting a name proves
    // the union lists it, not that anyone drew it. A <use> pointing at a
    // missing id renders nothing at all, silently.
    for (const name of SPRITE_NAMES) {
      expect(container.querySelector(`#${spriteId(name)}`)).not.toBeNull();
    }
  });

  it('defines no artwork the vocabulary does not name', () => {
    const { container } = render(<SpriteSheet />);
    const drawn = [...container.querySelectorAll('defs > g')].map((g) => g.id);

    expect(drawn.sort()).toEqual(SPRITE_NAMES.map(spriteId).sort());
  });

  it('keeps the sheet out of the accessibility tree', () => {
    const { container } = render(<SpriteSheet />);

    // It is a definition, not a picture — it must stay in the DOM and out of
    // the a11y tree.
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('sprite palette', () => {
  const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
  const palette = css.slice(css.indexOf('.sprite {'));

  /**
   * Feature sprites are illustrations: fixed palette, byte-identical in both
   * themes. Pointing a fill at a semantic token would make them change with the
   * theme, which is exactly the bug the two-tier system exists to prevent —
   * and it would look correct in whichever theme you happened to be testing.
   */
  it('uses fixed hex, never theme tokens', () => {
    const fills = [...palette.matchAll(/fill:\s*([^;]+);/g)].map((m) => m[1]!.trim());

    expect(fills.length).toBeGreaterThan(0);
    expect(fills.filter((fill) => fill.includes('var('))).toEqual([]);
  });
});
