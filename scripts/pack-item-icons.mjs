// @ts-check
/**
 * Packs the raw icon cache into the committed atlas sheets and writes the
 * manifest the app reads.
 *
 * Run:  node scripts/pack-item-icons.mjs
 *
 * Reads   `.icon-cache/<id>.png`            (gitignored — fetched by generate-item-icons.mjs)
 * Writes  `public/item-icons/atlas-<n>-<hash>.png`   (COMMITTED — this is delivery)
 *         `src/lib/ui/item-icons.generated.ts`       (COMMITTED — ids + atlas geometry)
 *
 * ── Why an atlas at all ─────────────────────────────────────────────────────
 *
 * ADR-0021 shipped `ItemIcon` with the PNGs gitignored, which left the app with
 * icons on exactly one machine. ADR-0022 resolves that: ten sheets answer the
 * owner's file-count objection (10, not 4,646) without moving the cost onto the
 * wiki the way a build-time fetch would.
 *
 * ── Why ten shards and not one sheet ────────────────────────────────────────
 *
 * Measured, not assumed: the whole set packs to 0.81 MB as one sheet and 0.80 MB
 * as ten. Sharding is free in bytes because PNG's win here is sharing one zlib
 * dictionary across many icons, and 512 icons already saturate that. What it
 * buys is the small-page case — a page showing three icons pulls ≤3×82 KB
 * instead of 829 KB — and the decode cost: one sheet is 2304×2628, which is
 * 24 MB of RGBA in memory to display a single whip.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// sharp is a devDependency, and deliberately not imported by anything under
// `src/` — it is a native module, and a hand-run script is the only place in
// this repo where that is acceptable.
const sharp = createRequire(import.meta.url)('sharp');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = join(ROOT, '.icon-cache');
const OUT_DIR = join(ROOT, 'public', 'item-icons');
const MANIFEST = join(ROOT, 'src', 'lib', 'ui', 'item-icons.generated.ts');

/**
 * The game's inventory cell. **Not derived from the icons** — the widest icon
 * in the current set is exactly 36×32, but a sample can only ever be a lower
 * bound, and sizing the cell from one is how a future game update silently
 * clips the widest item in the app and nowhere else. 36 is the documented
 * invariant; `assertFits` below enforces it rather than trusting it.
 */
const CELL = 36;

/** 32 × 16 = 512 icons per sheet, so a full shard is 1152×576. */
const COLUMNS = 32;
const SHARD_CAPACITY = 512;

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const ids = readdirSync(CACHE_DIR)
    .filter((f) => f.endsWith('.png'))
    .map((f) => Number(f.slice(0, -4)))
    // Ascending id order is load-bearing, not tidiness: an icon's position in
    // this array IS its cell in the atlas. Re-sort it without repacking and
    // every item silently renders as a different item.
    .sort((a, b) => a - b);

  if (!ids.length) {
    throw new Error(
      `no icons in ${CACHE_DIR} — run \`node scripts/generate-item-icons.mjs\` first`,
    );
  }
  console.log(`${ids.length} icons in the cache`);

  const { icons, blank } = await decodeAll(ids);
  if (blank.length) {
    // Item 34035 is literally named "Placeholder" and its icon is a 1×1
    // transparent PNG. Packing it would put an id in the manifest that
    // `hasItemIcon()` answers true for and that renders nothing — a lie the
    // shape of a design choice. Dropping it lets the `?` cell do its job.
    console.log(`skipped ${blank.length} blank icon(s): ${blank.join(', ')}`);
  }

  /*
   * Stale sheets go before new ones arrive. Filenames are content-hashed, so a
   * repack leaves the old ones orphaned in `public/` where they would be
   * committed, served, and never referenced.
   */
  for (const file of readdirSync(OUT_DIR)) {
    if (file.startsWith('atlas-') && file.endsWith('.png')) {
      rmSync(join(OUT_DIR, file));
    }
  }

  /** @type {string[]} */
  const shardFiles = [];

  for (let start = 0; start < icons.length; start += SHARD_CAPACITY) {
    const slice = icons.slice(start, start + SHARD_CAPACITY);
    const index = shardFiles.length;
    const png = await packShard(slice);

    // Content hash in the filename is the only thing making the atlas safe to
    // cache immutably (next.config.ts sets that header). Without it, a browser
    // holding yesterday's sheet against today's manifest renders every icon as
    // its neighbour — wrong, but plausible-looking, which is the worst shape.
    const hash = createHash('sha256').update(png).digest('hex').slice(0, 8);
    const name = `atlas-${index}-${hash}.png`;

    writeFileSync(join(OUT_DIR, name), png);
    shardFiles.push(name);
    console.log(
      `  ${name}  ${(png.length / 1024).toFixed(0)} KB  (${slice.length} icons)`,
    );
  }

  emitManifest(
    icons.map((icon) => icon.id),
    shardFiles,
  );
}

/** @typedef {{ id: number, data: Buffer, width: number, height: number }} Icon */

/**
 * Decodes the whole cache up front, so the sheet geometry can be computed from
 * what will actually be packed rather than from what happens to be on disk.
 *
 * @param {number[]} ids
 * @returns {Promise<{ icons: Icon[], blank: number[] }>}
 */
async function decodeAll(ids) {
  /** @type {Icon[]} */
  const icons = [];
  /** @type {number[]} */
  const blank = [];

  for (const id of ids) {
    const { data, info } = await sharp(join(CACHE_DIR, `${id}.png`))
      // Icons arrive as palette, greyscale+alpha and RGBA alike. Normalising to
      // 4 channels here is what lets the blit below be a straight row copy.
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    assertFits(id, info.width, info.height);

    if (isBlank(data)) blank.push(id);
    else icons.push({ id, data, width: info.width, height: info.height });
  }

  return { icons, blank };
}

/**
 * Fully transparent artwork is indistinguishable from a missing icon once it is
 * on screen, so it must be indistinguishable in the manifest too.
 *
 * @param {Buffer} rgba
 */
function isBlank(rgba) {
  for (let alpha = 3; alpha < rgba.length; alpha += 4) {
    if (rgba[alpha] > 0) return false;
  }
  return true;
}

/**
 * Blits one shard's icons into a fixed grid and encodes it.
 *
 * @param {Icon[]} icons
 * @returns {Promise<Buffer>}
 */
async function packShard(icons) {
  const rows = Math.ceil(icons.length / COLUMNS);
  const width = COLUMNS * CELL;
  const height = rows * CELL;
  const canvas = Buffer.alloc(width * height * 4);

  for (const [slot, icon] of icons.entries()) {
    /*
     * Centred with integer rounding. The old `<img>` centred with flexbox,
     * which lands a 25px-wide icon on a half-pixel — survivable for a raster at
     * natural size, fatal once the sheet is one image and everything must sit
     * on the same grid.
     */
    const originX = (slot % COLUMNS) * CELL + ((CELL - icon.width) >> 1);
    const originY = Math.floor(slot / COLUMNS) * CELL + ((CELL - icon.height) >> 1);

    for (let y = 0; y < icon.height; y += 1) {
      const from = y * icon.width * 4;
      icon.data.copy(
        canvas,
        ((originY + y) * width + originX) * 4,
        from,
        from + icon.width * 4,
      );
    }
  }

  return sharp(canvas, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9, effort: 10 })
    .toBuffer();
}

/**
 * @param {number} id
 * @param {number} width
 * @param {number} height
 */
function assertFits(id, width, height) {
  if (width > CELL || height > CELL) {
    // Loud, and it stops the run. An icon larger than the cell would be
    // silently cropped into its neighbour's square — art bleeding across a
    // grid boundary is not something a test of ours would notice.
    throw new Error(
      `item ${id} is ${width}×${height}, larger than the ${CELL}px cell. ` +
        `The game's inventory cell changed, or this is not an inventory icon. ` +
        `Raise CELL here and ITEM_ICON_CELL's documentation together.`,
    );
  }
}

/**
 * @param {number[]} ids
 * @param {string[]} shardFiles
 */
function emitManifest(ids, shardFiles) {
  // Wrapped at a fixed width rather than one id per line: Prettier reflows a
  // bare array anyway, and a 4,600-line diff on every game update buries the
  // handful of ids that actually changed.
  const body = [];
  for (let i = 0; i < ids.length; i += 20) {
    body.push('  ' + ids.slice(i, i + 20).join(', ') + ',');
  }

  const source = `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Written by \`node scripts/pack-item-icons.mjs\` on ${new Date().toISOString().slice(0, 10)},
 * describing the ${shardFiles.length} atlas sheets in \`public/item-icons/\` (ADR-0022).
 *
 * ⚠️ This file and those sheets are ONE artefact in two halves. An id's position
 * in \`ITEM_ICON_IDS\` is its cell in the atlas, so editing, sorting or filtering
 * this array without repacking repoints every icon after the edit at the wrong
 * item — which renders as art, not as an error.
 */

/** The game's inventory cell, and the grid every sheet is cut on. */
export const ATLAS_CELL = ${CELL};

/** Cells per row within a sheet. */
export const ATLAS_COLUMNS = ${COLUMNS};

/** Cells per sheet. Sheet = index / this, cell within it = index % this. */
export const ATLAS_SHARD_CAPACITY = ${SHARD_CAPACITY};

/**
 * Sheet filenames, in shard order, under \`/item-icons/\`. Content-hashed so they
 * can be served \`immutable\` — see next.config.ts.
 */
export const ATLAS_SHARDS: readonly string[] = [
${shardFiles.map((f) => `  '${f}',`).join('\n')}
];

/** Item ids in atlas order. Index into this array = cell index. */
export const ITEM_ICON_IDS: readonly number[] = [
${body.join('\n')}
];
`;

  writeFileSync(MANIFEST, source, 'utf8');
  console.log(`\nwrote ${shardFiles.length} sheets and a manifest of ${ids.length} ids`);
  // Generated TS is Prettier-formatted in this repo (the combat datasets are
  // too), so a fresh manifest fails `format:check` until this runs.
  console.log('next: npm run format && npm test');
}

await main();
