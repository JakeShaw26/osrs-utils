// @ts-check
/**
 * Regenerates the committed combat datasets from the OSRS Wiki Bucket API.
 *
 * Run manually after a game update:  node scripts/generate-combat-data.mjs
 *
 * ── Why a committed dataset rather than a runtime lookup ────────────────────
 *
 * The combat calculators need equipment bonuses for ~11 slots and stats for a
 * monster. Resolving those per request would be one upstream call per item —
 * exactly the fan-out `assertNoFanOut()` exists to stop (CLAUDE.md hard rule 4),
 * and on a public, auth-free app it turns us into an open proxy in front of the
 * wiki (PRD §5.3). Pre-aggregating into the repo removes the upstream from the
 * request path entirely, so the calculators need no rate limiter, no cache and
 * no database — they are pure functions over data that only changes on a weekly
 * game update. See ADR-0015.
 *
 * ── Why plain fetch here and not osrsFetch() ────────────────────────────────
 *
 * `osrsFetch()` is `server-only` and passes Next's `next.revalidate`, neither of
 * which exists in a bare node script. Hard rule 1 protects *application* code
 * paths; this file is a developer tool that runs by hand. It still sends the
 * User-Agent the wiki requires, and it makes exactly two requests in total.
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const USER_AGENT =
  'osrs-clan-toolkit/0.1 (clan tool data generation; github.com/JakeShaw26/osrs-utils)';

const OUT_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'lib',
  'combat',
  'data',
);

/* ── Curated selections ─────────────────────────────────────────────────────
 * Deliberately a curated list, not "every item". A <select> with 4,000 options
 * is unusable, the bundle cost is real, and the long tail of items nobody in a
 * 78-member clan will pick adds nothing. Add names here as they are asked for.
 */

const ITEMS = [
  // Head
  'Torva full helm',
  'Neitiznot faceguard',
  'Helm of neitiznot',
  'Slayer helmet (i)',
  'Rune full helm',
  'Void melee helm',
  'Void ranger helm',
  'Void mage helm',
  'Masori mask (f)',
  'Armadyl helmet',
  'Ancestral hat',
  "Ahrim's hood",
  // Cape
  'Infernal cape',
  'Fire cape',
  "Ava's assembler",
  'Imbued saradomin cape',
  'Obsidian cape',
  // Neck
  'Amulet of torture',
  'Amulet of fury',
  'Amulet of strength',
  'Salve amulet',
  'Salve amulet (e)',
  'Salve amulet(i)',
  'Salve amulet(ei)',
  'Necklace of anguish',
  'Occult necklace',
  'Amulet of glory',
  // Ammo
  'Dragon arrow',
  'Rune arrow',
  'Amethyst arrow',
  'Ruby dragon bolts (e)',
  'Diamond dragon bolts (e)',
  'Runite bolts',
  // Weapons — melee
  'Scythe of vitur',
  'Ghrazi rapier',
  "Osmumten's fang",
  'Abyssal whip',
  'Abyssal bludgeon',
  'Dragon scimitar',
  "Dharok's greataxe",
  'Rune 2h sword',
  "Inquisitor's mace",
  'Elder maul',
  'Dragon dagger',
  'Dragon warhammer',
  // Weapons — ranged
  'Twisted bow',
  'Toxic blowpipe',
  'Armadyl crossbow',
  'Zaryte crossbow',
  'Rune crossbow',
  'Magic shortbow',
  'Bow of faerdhinen (c)',
  'Amethyst dart',
  // Weapons — magic
  "Tumeken's shadow",
  'Sanguinesti staff',
  'Trident of the swamp',
  'Kodai wand',
  'Master wand',
  'Harmonised nightmare staff',
  // Body
  'Torva platebody',
  'Bandos chestplate',
  'Fighter torso',
  'Rune platebody',
  'Void knight top',
  'Elite void top',
  'Masori body (f)',
  'Armadyl chestplate',
  "Black d'hide body",
  'Ancestral robe top',
  "Ahrim's robetop",
  // Shield
  'Avernic defender',
  'Dragon defender',
  'Rune kiteshield',
  "Elidinis' ward (f)",
  'Tome of fire',
  'Twisted buckler',
  'Dragonfire shield',
  // Legs
  'Torva platelegs',
  'Bandos tassets',
  'Rune platelegs',
  'Void knight robe',
  'Elite void robe',
  'Masori chaps (f)',
  'Armadyl chainskirt',
  "Black d'hide chaps",
  'Ancestral robe bottom',
  // Hands
  'Ferocious gloves',
  'Barrows gloves',
  'Rune gloves',
  'Void knight gloves',
  'Zaryte vambraces',
  "Black d'hide vambraces",
  'Tormented bracelet',
  // Feet
  'Primordial boots',
  'Dragon boots',
  'Rune boots',
  'Decorative boots (gold)',
  'Pegasian boots',
  'Ranger boots',
  'Eternal boots',
  // Ring
  'Ultor ring',
  'Berserker ring',
  'Venator ring',
  'Archers ring',
  'Magus ring',
  'Seers ring',
  'Lightbearer',
];

const MONSTERS = [
  'Abyssal demon',
  'Bloodveld',
  'Gargoyle',
  'Nechryael',
  'Hellhound',
  'Blue dragon',
  'Vorkath',
  'Zulrah',
  'General Graardor',
  "K'ril Tsutsaroth",
  'Commander Zilyana',
  "Kree'arra",
  'Kalphite Queen',
  'Giant Mole',
  'Dagannoth Rex',
  'Alchemical Hydra',
  'Corporeal Beast',
  'Cow',
];

/* ── Fetching ─────────────────────────────────────────────────────────────── */

/**
 * One bulk request per bucket, filtered locally.
 *
 * The alternative — one `.where('page_name', …)` request per item — would be
 * ~120 requests against a wiki whose rate limits are undocumented, and five
 * sibling agents share this IP. Two requests is strictly politer.
 *
 * @param {string} bucket
 * @param {readonly string[]} fields
 */
async function bulkQuery(bucket, fields) {
  const query =
    `bucket('${bucket}')` +
    `.select(${fields.map((f) => `'${f}'`).join(',')})` +
    `.limit(5000).run()`;

  const url = new URL('https://oldschool.runescape.wiki/api.php');
  url.searchParams.set('action', 'bucket');
  url.searchParams.set('format', 'json');
  url.searchParams.set('query', query);

  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`${bucket}: HTTP ${response.status}`);

  // A malformed Bucket query answers HTTP 200 with an `error` field, so the
  // status check above is not enough — a typo would look like an empty result.
  const body = await response.json();
  if (body.error) throw new Error(`${bucket}: ${body.error}`);

  return /** @type {Record<string, unknown>[]} */ (body.bucket ?? []);
}

/** @param {unknown} v */
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** @param {unknown} v */
const firstString = (v) =>
  Array.isArray(v) ? (v[0] ?? null) : typeof v === 'string' ? v : null;

/** @param {unknown} v */
const strings = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);

/* ── Equipment ────────────────────────────────────────────────────────────── */

const BONUS_FIELDS = [
  'page_name',
  'equipment_slot',
  'combat_style',
  'weapon_attack_speed',
  'stab_attack_bonus',
  'slash_attack_bonus',
  'crush_attack_bonus',
  'range_attack_bonus',
  'magic_attack_bonus',
  'strength_bonus',
  'ranged_strength_bonus',
  'magic_damage_bonus',
  'prayer_bonus',
];

async function buildEquipment() {
  const rows = await bulkQuery('infobox_bonuses', BONUS_FIELDS);
  const wanted = new Set(ITEMS);

  /** @type {Map<string, Record<string, unknown>>} */
  const best = new Map();
  for (const row of rows) {
    const name = firstString(row.page_name);
    if (!name || !wanted.has(name)) continue;

    // Multi-version pages return one row per variant, and for equipment those
    // variants are usually degraded / broken forms whose bonuses are all zero
    // (Dharok's greataxe ships a 105-strength row and a 0-strength row). Keeping
    // the row with the largest total magnitude picks the undamaged item, which
    // is the one a calculator is asked about.
    const magnitude = BONUS_FIELDS.filter((f) => f.endsWith('_bonus')).reduce(
      (sum, f) => sum + Math.abs(num(row[f])),
      0,
    );
    const incumbent = best.get(name);
    if (!incumbent || magnitude > Number(incumbent.__magnitude)) {
      best.set(name, { ...row, __magnitude: magnitude });
    }
  }

  const missing = ITEMS.filter((n) => !best.has(n));
  if (missing.length) console.warn(`⚠ equipment not found: ${missing.join(', ')}`);

  return [...best.values()]
    .map((row) => ({
      name: firstString(row.page_name),
      slot: firstString(row.equipment_slot),
      weaponCategory: firstString(row.combat_style),
      attackSpeed:
        row.weapon_attack_speed === undefined ? null : num(row.weapon_attack_speed),
      stab: num(row.stab_attack_bonus),
      slash: num(row.slash_attack_bonus),
      crush: num(row.crush_attack_bonus),
      ranged: num(row.range_attack_bonus),
      magic: num(row.magic_attack_bonus),
      strength: num(row.strength_bonus),
      rangedStrength: num(row.ranged_strength_bonus),
      magicDamage: num(row.magic_damage_bonus),
      prayer: num(row.prayer_bonus),
    }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

/* ── Monsters ─────────────────────────────────────────────────────────────── */

const MONSTER_FIELDS = [
  'name',
  'version_anchor',
  'combat_level',
  'hitpoints',
  'max_hit',
  'attack_level',
  'strength_level',
  'defence_level',
  'magic_level',
  'ranged_level',
  'stab_defence_bonus',
  'slash_defence_bonus',
  'crush_defence_bonus',
  'magic_defence_bonus',
  'standard_range_defence_bonus',
  'attack_speed',
  'size',
  'attribute',
  'slayer_category',
];

async function buildMonsters() {
  const rows = await bulkQuery('infobox_monster', MONSTER_FIELDS);
  const wanted = new Set(MONSTERS);
  const found = new Set();

  const selected = rows
    .filter((row) => {
      const name = firstString(row.name);
      if (!name || !wanted.has(name)) return false;
      found.add(name);
      return true;
    })
    // Every version is kept. Zulrah is three rows with different defences and
    // Vorkath is two; collapsing them would silently answer about the wrong
    // fight. The UI makes the user pick.
    .map((row) => ({
      name: firstString(row.name),
      version: firstString(row.version_anchor) ?? 'Standard',
      combatLevel: num(row.combat_level),
      hitpoints: num(row.hitpoints),
      attack: num(row.attack_level),
      strength: num(row.strength_level),
      defence: num(row.defence_level),
      magic: num(row.magic_level),
      ranged: num(row.ranged_level),
      stabDefence: num(row.stab_defence_bonus),
      slashDefence: num(row.slash_defence_bonus),
      crushDefence: num(row.crush_defence_bonus),
      magicDefence: num(row.magic_defence_bonus),
      // `range_defence_bonus` is in the published schema but is null on all
      // 3,234 rows — the wiki populates the light/standard/heavy split instead.
      // Standard is the one that applies to arrows and bolts.
      rangedDefence: num(row.standard_range_defence_bonus),
      size: num(row.size),
      attributes: strings(row.attribute),
      slayerCategories: strings(row.slayer_category),
    }))
    .sort(
      (a, b) =>
        String(a.name).localeCompare(String(b.name)) ||
        String(a.version).localeCompare(String(b.version)),
    );

  const missing = MONSTERS.filter((n) => !found.has(n));
  if (missing.length) console.warn(`⚠ monsters not found: ${missing.join(', ')}`);

  // Several version anchors are the *same fight* — an abyssal demon has one
  // stat block published under three location names. Offering three identical
  // options is noise. Versions whose stats genuinely differ (Zulrah's forms,
  // Vorkath pre/post quest) survive this, which is the case that matters.
  /** @type {Map<string, (typeof selected)[number]>} */
  const distinct = new Map();
  for (const row of selected) {
    // Key on sorted entries, not raw JSON: Bucket does not guarantee field
    // order, so two identical rows can stringify differently and both survive.
    const key = JSON.stringify(
      Object.entries({ ...row, version: null }).sort(([a], [b]) => a.localeCompare(b)),
    );
    if (!distinct.has(key)) distinct.set(key, row);
  }

  // `name|version` is the identity the UI selects on. Two rows that genuinely
  // differ but share a version anchor would collide into one option, so make
  // the second one visibly distinct rather than silently unreachable.
  const used = new Set();
  return [...distinct.values()].map((row) => {
    let version = row.version;
    for (let n = 2; used.has(`${row.name}|${version}`); n += 1) {
      version = `${row.version} (${n})`;
    }
    used.add(`${row.name}|${version}`);
    return { ...row, version };
  });
}

/* ── Emit ─────────────────────────────────────────────────────────────────── */

/**
 * @param {string} file
 * @param {string} typeName
 * @param {string} constName
 * @param {unknown[]} data
 * @param {string} note
 */
function emit(file, typeName, constName, data, note) {
  const source = `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Source: OSRS Wiki Bucket API, generated ${new Date().toISOString().slice(0, 10)}
 * by \`node scripts/generate-combat-data.mjs\`. ${note}
 *
 * The numbers here are game facts published by the wiki, not third-party source
 * code (ADR-0007). Re-run the generator after a game update rather than editing.
 */

import type { ${typeName} } from '../types';

export const ${constName}: readonly ${typeName}[] = ${JSON.stringify(data, null, 2)};
`;
  writeFileSync(join(OUT_DIR, file), source, 'utf8');
  console.log(`wrote ${file} (${data.length} rows)`);
}

const [equipment, monsters] = await Promise.all([buildEquipment(), buildMonsters()]);

emit(
  'equipment.generated.ts',
  'EquipmentItem',
  'EQUIPMENT',
  equipment,
  'Curated subset — extend ITEMS in the generator to add more.',
);
emit(
  'monsters.generated.ts',
  'MonsterStats',
  'MONSTERS',
  monsters,
  'One row per wiki version; a monster with several forms appears several times.',
);
