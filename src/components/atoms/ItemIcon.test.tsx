import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ItemIcon } from './ItemIcon';
import { ITEM_ICON_IDS, hasItemIcon, itemIconSrc } from '@/lib/ui/item-icons';

/** An id the generator is certain to have covered — the whip is tradeable. */
const WHIP = 4151;
/** Outside the tradeable mapping, so deliberately absent. */
const UNKNOWN = 999_999_999;

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

  it('serves the icon from our own origin, never the wiki', () => {
    const { container } = render(<ItemIcon id={WHIP} name="Abyssal whip" />);
    const src = container.querySelector('img')?.getAttribute('src');

    // Hotlinking spends the wiki's bandwidth on our traffic, which
    // docs/api-terms.md §2 rule 7 rules out. A relative path cannot regress to
    // an absolute one without this failing.
    expect(src).toBe(itemIconSrc(WHIP));
    expect(src).not.toMatch(/^https?:/);
  });

  /**
   * `image-rendering: pixelated` is to a raster what `shape-rendering:
   * crispEdges` is to the SVG sprites — without it the browser smooths ~30px
   * game art into mush. Neither property substitutes for the other.
   */
  it('renders with the class that disables smoothing', () => {
    const { container } = render(<ItemIcon id={WHIP} />);

    expect(container.querySelector('img')).toHaveClass('item-icon');
  });

  it('reserves a fixed cell so differing icon widths still line up', () => {
    const { container } = render(<ItemIcon id={WHIP} />);

    expect(container.firstElementChild).toHaveStyle({ width: '36px', height: '36px' });
  });

  it('doubles the cell and the artwork together at scale 2', () => {
    const { container } = render(<ItemIcon id={WHIP} scale={2} />);

    expect(container.firstElementChild).toHaveStyle({ width: '72px', height: '72px' });
    expect(container.querySelector('img')).toHaveStyle({ transform: 'scale(2)' });
  });

  /**
   * Untradeable ids reach us from drop tables and clue rewards, and the price
   * mapping only covers tradeables. A missing icon is an expected state, so it
   * must render an empty cell — an <img> at a 404 renders a broken-image glyph
   * that no amount of styling removes.
   */
  it('renders an empty cell rather than a broken image for an unknown id', () => {
    const { container } = render(<ItemIcon id={UNKNOWN} name="Nonexistent" />);

    expect(container.querySelector('img')).toBeNull();
    expect(container.firstElementChild).toHaveStyle({ width: '36px' });
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

/**
 * The guard that reads a different source than the code it guards — the
 * filesystem, not the manifest. `hasItemIcon(id)` returning true proves the
 * generated list contains the id, never that the PNG was actually written, and
 * an <img> at a missing path fails silently in exactly the way the sprite
 * `<use href="#missing">` did.
 */
describe('item icon manifest', () => {
  const dir = join(process.cwd(), 'public', 'item-icons');

  // The manifest itself is committed; the PNGs it names are gitignored
  // (ADR-0021). So on a fresh checkout there is nothing to compare against and
  // these two assertions have no subject.
  const onDisk = existsSync(dir)
    ? new Set(
        readdirSync(dir)
          .filter((f) => f.endsWith('.png'))
          .map((f) => Number(f.slice(0, -4))),
      )
    : null;

  it('is not empty', () => {
    // A generator that failed early writes a valid, useless manifest.
    expect(ITEM_ICON_IDS.length).toBeGreaterThan(4000);
  });

  it('holds no duplicate ids', () => {
    expect(new Set(ITEM_ICON_IDS).size).toBe(ITEM_ICON_IDS.length);
  });

  /*
   * ⚠️ PROVISIONAL — these two skip when the icons are absent, which is the one
   * concession in this suite to a guard that cannot see its subject.
   *
   * That is deliberate but temporary. Compare `postgres-store.live.test.ts`,
   * which *fails* when CI is set and no database is reachable, precisely so
   * deleting the service block cannot quietly reduce coverage. The same
   * treatment is wrong here only because icon delivery is genuinely undecided —
   * failing CI would assert a mechanism nobody has chosen yet.
   *
   * Once delivery lands, make these unconditional. A skipped guard that stays
   * skipped is how a suite starts lying.
   */
  it.runIf(onDisk)('has a file on disk for every id it claims', () => {
    expect(ITEM_ICON_IDS.filter((id) => !onDisk!.has(id))).toEqual([]);
  });

  it.runIf(onDisk)('claims every file on disk', () => {
    // An orphan means a rename or a partial run left art we never serve.
    expect([...onDisk!].filter((id) => !hasItemIcon(id))).toEqual([]);
  });
});
