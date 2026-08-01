import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  ATLAS_CELL,
  ATLAS_COLUMNS,
  ATLAS_SHARD_CAPACITY,
  ATLAS_SHARDS,
  ITEM_ICON_IDS,
} from './item-icons.generated';
import { itemIconPosition } from './item-icons';

/**
 * The manifest and the atlas sheets are one artefact in two halves, and only one
 * half is readable in a diff. These guards read the other half — the actual
 * pixels of the actual committed PNGs — because every failure mode here renders
 * as *artwork*, not as an error: an off-by-one in the packing order shows the
 * next item's icon, which looks entirely deliberate.
 *
 * ADR-0022. These replace the two `it.runIf` guards that skipped while the icons
 * were gitignored; the sheets are committed now, so nothing here may skip.
 */

const DIR = join(process.cwd(), 'public', 'item-icons');

/** Decoded once — ten sheets is a few hundred milliseconds, per assertion is not. */
const sheets = await Promise.all(
  ATLAS_SHARDS.map(async (file) => {
    const bytes = readFileSync(join(DIR, file));
    const { data, info } = await sharp(bytes)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return { file, bytes, data, width: info.width, height: info.height };
  }),
);

describe('item icon atlas', () => {
  it('is not empty', () => {
    // A generator that failed early writes a valid, useless manifest.
    expect(ITEM_ICON_IDS.length).toBeGreaterThan(4000);
    expect(ATLAS_SHARDS.length).toBeGreaterThan(0);
  });

  it('holds no duplicate ids', () => {
    expect(new Set(ITEM_ICON_IDS).size).toBe(ITEM_ICON_IDS.length);
  });

  /**
   * Ascending order is not tidiness — an id's index in this array IS its cell in
   * the sheet. Sorting, filtering or hand-editing the array without repacking
   * repoints every icon after the edit at the wrong item.
   */
  it('lists ids in the ascending order the packer packed them in', () => {
    const misordered = ITEM_ICON_IDS.findIndex(
      (id, i) => i > 0 && id <= ITEM_ICON_IDS[i - 1]!,
    );

    expect(misordered).toBe(-1);
  });

  it('ships exactly the sheets the manifest names', () => {
    const onDisk = readdirSync(DIR).filter(
      (f) => f.startsWith('atlas-') && f.endsWith('.png'),
    );

    // An orphan means a repack left a sheet nobody references — dead weight in
    // git, and served to anyone who guesses the URL.
    expect(onDisk.sort()).toEqual([...ATLAS_SHARDS].sort());
  });

  it('covers every id with a sheet', () => {
    expect(ATLAS_SHARDS.length).toBe(
      Math.ceil(ITEM_ICON_IDS.length / ATLAS_SHARD_CAPACITY),
    );
  });

  /**
   * next.config.ts serves these `immutable` for a year, which is only safe
   * because the filename carries the content hash. If a sheet's bytes and its
   * name ever disagree, a browser can cache a stale sheet against a fresh
   * manifest and render every icon as its neighbour.
   */
  it('names each sheet after its own contents', () => {
    for (const [index, sheet] of sheets.entries()) {
      const digest = createHash('sha256').update(sheet.bytes).digest('hex').slice(0, 8);

      expect(sheet.file).toBe(`atlas-${index}-${digest}.png`);
    }
  });

  it('sizes each sheet to the grid the manifest addresses', () => {
    for (const [index, sheet] of sheets.entries()) {
      const cells = Math.min(
        ATLAS_SHARD_CAPACITY,
        ITEM_ICON_IDS.length - index * ATLAS_SHARD_CAPACITY,
      );

      expect({ w: sheet.width, h: sheet.height }).toEqual({
        w: ATLAS_COLUMNS * ATLAS_CELL,
        h: Math.ceil(cells / ATLAS_COLUMNS) * ATLAS_CELL,
      });
    }
  });

  /**
   * The assertion that reads pixels rather than metadata. Everything above could
   * pass against ten sheets of pure transparency; this cannot.
   *
   * It also pins the one thing `hasItemIcon()` is supposed to promise — that an
   * id it answers true for has something to show. Item 34035 ("Placeholder") is
   * a 1×1 transparent PNG in the price mapping, and the packer drops it for
   * exactly this reason.
   */
  it('has visible artwork in every cell it claims', () => {
    const empty = ITEM_ICON_IDS.filter((id) => {
      const position = itemIconPosition(id)!;
      const sheet = sheets.find((s) => position.src.endsWith(s.file))!;

      for (let y = 0; y < ATLAS_CELL; y += 1) {
        let alpha = ((position.y + y) * sheet.width + position.x) * 4 + 3;
        for (let x = 0; x < ATLAS_CELL; x += 1, alpha += 4) {
          if (sheet.data[alpha]! > 0) return false;
        }
      }
      return true;
    });

    expect(empty).toEqual([]);
  });
});
