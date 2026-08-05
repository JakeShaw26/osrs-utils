import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ItemIcon } from './ItemIcon';
import { itemIconPosition } from '@/lib/ui/item-icons';

/** An id the generator is certain to have covered — the whip is tradeable. */
const WHIP = 4151;
/** Outside the tradeable mapping, so deliberately absent. */
const UNKNOWN = 999_999_999;

/** The cell element itself, which carries the sheet and the offset. */
const cellOf = (container: HTMLElement) => container.querySelector('.item-icon');

describe('ItemIcon', () => {
  it('names itself for assistive tech when it carries meaning', () => {
    render(<ItemIcon id={WHIP} name="Abyssal whip" />);

    expect(screen.getByRole('img', { name: 'Abyssal whip' })).toBeInTheDocument();
  });

  /**
   * An icon beside a visible label that says the same word must be decorative,
   * or a screen reader announces "Abyssal whip Abyssal whip".
   */
  it('is decorative when it has no name', () => {
    render(<ItemIcon id={WHIP} />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('serves the artwork from our own origin, never the wiki', () => {
    const { container } = render(<ItemIcon id={WHIP} name="Abyssal whip" />);
    const background = cellOf(container)?.getAttribute('style');

    // Hotlinking spends the wiki's bandwidth on our traffic, which
    // docs/api-terms.md §2 rule 7 rules out. A relative path cannot regress to
    // an absolute one without this failing.
    // Quote-tolerant: jsdom re-serialises `url(…)` with quotes, browsers vary.
    expect(background).toMatch(/url\(["']?\/item-icons\/atlas-/);
    expect(background).not.toMatch(/url\(["']?https?:/);
  });

  /**
   * The atlas is addressed by offset, so the offset is the whole mechanism —
   * a cell at the wrong coordinates renders a different item's art, which looks
   * deliberate rather than broken. `item-icons.atlas.test.ts` proves the
   * coordinates land on real pixels; this proves the component uses them.
   */
  it('offsets the sheet to the cell the manifest gives for this id', () => {
    const position = itemIconPosition(WHIP)!;
    const { container } = render(<ItemIcon id={WHIP} />);

    expect(cellOf(container)).toHaveStyle({
      backgroundPosition: `-${position.x}px -${position.y}px`,
    });
  });

  /**
   * `image-rendering: pixelated` is to a raster what `shape-rendering:
   * crispEdges` is to the SVG sprites — without it the browser smooths ~30px
   * game art into mush. Neither property substitutes for the other, and the
   * class is also what stops the sheet tiling across the cell.
   */
  it('renders with the class that disables smoothing', () => {
    const { container } = render(<ItemIcon id={WHIP} />);

    expect(cellOf(container)).not.toBeNull();
  });

  it('reserves a fixed cell so differing icon widths still line up', () => {
    const { container } = render(<ItemIcon id={WHIP} />);

    expect(container.firstElementChild).toHaveStyle({ width: '36px', height: '36px' });
  });

  it('doubles the cell and the artwork together at scale 2', () => {
    const { container } = render(<ItemIcon id={WHIP} scale={2} />);

    expect(container.firstElementChild).toHaveStyle({ width: '72px', height: '72px' });
    expect(cellOf(container)).toHaveStyle({ transform: 'scale(2)' });
  });

  /**
   * Untradeable ids reach us from drop tables and clue rewards, and the price
   * mapping only covers tradeables. A missing icon is an expected state, so it
   * must render an empty cell that still occupies its space in a table row.
   */
  it('renders an empty cell rather than stray artwork for an unknown id', () => {
    const { container } = render(<ItemIcon id={UNKNOWN} name="Nonexistent" />);

    expect(cellOf(container)).toBeNull();
    expect(container.firstElementChild).toHaveStyle({ width: '36px' });
  });

  /**
   * An empty cell is not an image, so announcing one would describe something
   * that is not there. The name is dropped with the artwork.
   */
  it('announces nothing for an unknown id', () => {
    render(<ItemIcon id={UNKNOWN} name="Nonexistent" />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('wraps a slotted icon in an inventory slot', () => {
    const { container } = render(<ItemIcon id={WHIP} slotted />);

    expect(container.firstElementChild).toHaveClass('bg-sprite-slot');
  });

  it('does not wrap an unslotted icon', () => {
    const { container } = render(<ItemIcon id={WHIP} />);

    expect(container.firstElementChild).not.toHaveClass('bg-sprite-slot');
  });
});
