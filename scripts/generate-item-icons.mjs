// @ts-check
/**
 * Downloads the OSRS item icon set into the gitignored cache at
 * `.icon-cache/<id>.png`, then hands off to the packer.
 *
 * Run after a game update:  npm run icons
 * Re-download everything:   node scripts/generate-item-icons.mjs --refresh
 *
 * ── What this writes ────────────────────────────────────────────────────────
 *
 * This is the only generator in the repo that writes *art* rather than numbers,
 * which makes it the one place ADR-0007's "copy nothing" rule needed an explicit
 * amendment. See ADR-0021 for the licensing position; the short version is that
 * the icons are Jagex's, the wiki hosts them under fair use, and we display them
 * on the same tolerated-not-licensed footing we already rely on for hiscores.
 *
 * ⚠️ Nothing this script writes is committed. `.icon-cache/` is a fetch cache;
 * what ships is the packed atlas that `scripts/pack-item-icons.mjs` builds from
 * it (ADR-0022). **Do not "fix" a missing cache by calling this from a build
 * step**: that is ~4,600 wiki requests every build, precisely the "multiple
 * large queries per second for a sustained period" that docs/api-terms.md §2
 * records as their stated limit. The atlas exists so the build never needs this.
 *
 * ── Why plain fetch and not osrsFetch() ─────────────────────────────────────
 *
 * Same reason as generate-combat-data.mjs: `osrsFetch()` is `server-only`,
 * passes Next's `next.revalidate`, and returns JSON. None of those exist or
 * apply in a bare node script downloading PNGs. Hard rule 1 protects
 * *application* code paths. The mandatory User-Agent is still sent on every
 * request, and the throttle below is stricter than anything the app does.
 */

import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const USER_AGENT =
  'osrs-clan-toolkit/0.1 (clan tool icon generation; github.com/JakeShaw26/osrs-utils)';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, '.icon-cache');

const MAPPING_URL = 'https://prices.runescape.wiki/api/v1/osrs/mapping';
const IMAGE_BASE = 'https://oldschool.runescape.wiki/images/';

const REFRESH = process.argv.includes('--refresh');

/* ── Politeness ─────────────────────────────────────────────────────────────
 * ~8 requests/second, enforced by a shared cursor rather than a per-worker
 * sleep — with N workers, `await sleep(delay)` in each gives N× the intended
 * rate, which is the classic way a "throttled" scraper turns out not to be.
 * The wiki publishes no rate limit; their stated concern is sustained load, and
 * this run is ~10 minutes once rather than every build.
 */
const CONCURRENCY = 4;

let spacingMs = 125;
let nextSlot = 0;

const sleep = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms));

async function throttle() {
  const now = Date.now();
  const slot = Math.max(now, nextSlot);
  nextSlot = slot + spacingMs;
  if (slot > now) await sleep(slot - now);
}

/**
 * MediaWiki serves files under the title with spaces as underscores. The
 * encode must happen *after* that swap, and it matters: 294 of 4,650 icon
 * filenames contain a character that needs it, including `Adamant arrow(p+) 5.png`
 * whose `+` becomes `%2B` (a literal `+` in a path is fine, but leaving it
 * unencoded relies on that staying true).
 *
 * @param {string} filename
 */
function imageUrl(filename) {
  return IMAGE_BASE + encodeURIComponent(filename.replace(/ /g, '_'));
}

/**
 * One retry, because a transient blip across ~4,600 requests is close to
 * certain and losing an icon to it is silent. A 429 is different in kind: it
 * means we are the problem, so it permanently widens the spacing for the rest
 * of the run rather than just waiting once. api-terms.md §6.4 — back off, never
 * retry-storm.
 *
 * @param {string} url
 */
async function getBuffer(url) {
  for (let attempt = 0; ; attempt += 1) {
    await throttle();
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });

    if (response.ok) return Buffer.from(await response.arrayBuffer());

    if (response.status === 429 || response.status === 403) {
      spacingMs = Math.min(spacingMs * 2, 2000);
      console.warn(`  ⚠ HTTP ${response.status} — spacing widened to ${spacingMs}ms`);
      if (attempt === 0) {
        await sleep(5000);
        continue;
      }
    } else if (attempt === 0 && response.status >= 500) {
      continue;
    }

    throw new Error(`HTTP ${response.status}`);
  }
}

/* ── Mapping ────────────────────────────────────────────────────────────────
 * `/mapping` carries an `icon` field for every item, and it is authoritative.
 * Deriving the filename as `${name}.png` looks right and is wrong for 294 items
 * — `Acorn` is drawn by `Acorn 5.png`, `Abyssal bracelet(5)` by
 * `Abyssal bracelet.png` — and every one of those fails as a silent 404 rather
 * than an error. Never derive this.
 */

/** @typedef {{ id: number, name: string, icon: string }} MappingItem */

async function loadMapping() {
  await throttle();
  const response = await fetch(MAPPING_URL, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`mapping: HTTP ${response.status}`);
  return /** @type {MappingItem[]} */ (await response.json());
}

/* ── Download ───────────────────────────────────────────────────────────── */

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const mapping = await loadMapping();
  console.log(`mapping: ${mapping.length} items`);

  const present = new Set(
    REFRESH
      ? []
      : readdirSync(OUT_DIR)
          .filter((f) => f.endsWith('.png'))
          .map((f) => Number(f.slice(0, -4))),
  );

  // 4,650 items share 4,636 distinct icon files, so a naive per-item loop
  // re-downloads a handful for no reason. Group first, fetch once, write to
  // every id that uses it.
  /** @type {Map<string, number[]>} */
  const byFile = new Map();
  for (const item of mapping) {
    if (!item.icon || present.has(item.id)) continue;
    const ids = byFile.get(item.icon);
    if (ids) ids.push(item.id);
    else byFile.set(item.icon, [item.id]);
  }

  const jobs = [...byFile.entries()];
  console.log(
    `${present.size} already present, ${jobs.length} files to fetch` +
      (REFRESH ? ' (--refresh)' : ''),
  );

  /** @type {{ file: string, reason: string }[]} */
  const failures = [];
  let done = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < jobs.length) {
      const index = cursor++;
      const [file, ids] = jobs[index];
      try {
        const buffer = await getBuffer(imageUrl(file));
        for (const id of ids) writeFileSync(join(OUT_DIR, `${id}.png`), buffer);
        for (const id of ids) present.add(id);
      } catch (error) {
        failures.push({
          file,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
      done += 1;
      if (done % 250 === 0) console.log(`  ${done}/${jobs.length}`);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  if (failures.length) {
    console.warn(`\n⚠ ${failures.length} icons failed:`);
    for (const f of failures.slice(0, 20)) console.warn(`   ${f.file}: ${f.reason}`);
    if (failures.length > 20) console.warn(`   …and ${failures.length - 20} more`);
  }

  console.log(
    `\ncache now holds ${present.size} icons of ${mapping.length} mapped items`,
  );
  // The download is the slow, throttled, network-bound half; packing is local
  // and takes seconds. Keeping them separate means a repack — after changing
  // the cell size, the shard capacity, or the packing order — costs nothing and
  // never touches the wiki.
  console.log('next: npm run icons:pack');
}

await main();
