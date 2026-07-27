import 'server-only';
import { osrsFetch } from './osrs-fetch';

/**
 * OSRS Wiki **Bucket** API — static game data.
 *
 * Bucket is the wiki's semantic data layer, replacing the deprecated Semantic
 * MediaWiki `action=ask`. It is our source for item, monster, equipment and
 * quest data, and the reason we never need `osrsbox-db` (hard rule #8,
 * ADR-0004).
 *
 * Verified behaviour: docs/api-notes/osrs-wiki-bucket.md. Two things dominate
 * the design of this module:
 *
 *  1. **The `query` parameter is a program, not a filter string.** The server
 *     parses it (a raw apostrophe returns `')' expected near 's'` — a Lua
 *     parser error), so interpolating an unescaped value is injection, not a
 *     formatting bug. See `escapeLiteral`.
 *  2. **Field names are not guessable and unknown ones are hard errors.**
 *     `highalch` and `monster_name` do not exist; `high_alchemy_value` and
 *     `name` do. Introspect before inventing a query — the recipe is in the
 *     api-notes.
 */

/**
 * Bucket names verified to exist. An unknown name is a hard error upstream.
 *
 * This is a whitelist of what we have actually introspected, not the full
 * namespace — a 2026-07-26 probe found **47 buckets**, so a name being absent
 * here means "not yet verified", never "does not exist".
 */
export const BUCKETS = {
  item: 'infobox_item',
  monster: 'infobox_monster',
  /** Equipment stats — attack/defence bonuses, slot, attack speed. */
  bonuses: 'infobox_bonuses',
  /** Quest prose. Requirements are embedded as `<span class="scp">` markup. */
  quest: 'quest',
  /**
   * 646 structured rows: `id`, `name`, `monster`, `task`, `tier`, `type`.
   * Its existence is why the CA task list is a fetch rather than a content
   * project — but completion remains unavailable from any API (ADR-0012).
   */
  combatAchievement: 'combat_achievement',
  /**
   * Drop tables: `item_name` (PAGE), `drop_json` (TEXT), `rare_drop_table`
   * (BOOLEAN). ⚠️ `drop_json` is `"index": false` — it can be **selected but
   * not filtered on**, so queries must filter by item and parse client-side.
   */
  drops: 'dropsline',
} as const;

/**
 * Present on every bucket and absent from the published schemas: the wiki page
 * the row came from. It is the only key that joins buckets to each other —
 * `infobox_bonuses` has no item name field, so equipment stats reach their item
 * exclusively through this.
 */
export const PAGE_NAME = 'page_name';

/**
 * Several fields are `repeated` and come back as arrays even when a single
 * value is expected — verified on `item_id` (`["1127"]`) and `max_hit`
 * (`["41"]`), while `combat_level` is a plain number. Which is which is not
 * predictable from the field's meaning, so treat any field as possibly
 * repeated and unwrap with `firstValue`.
 */
export type Repeatable<T> = T | T[] | null | undefined;

export interface BucketQuerySpec {
  bucket: string;
  /** Required — an empty select is an error upstream. */
  select: readonly string[];
  /** Equality filters, ANDed. */
  where?: readonly (readonly [field: string, value: string | number | boolean])[];
  limit?: number;
}

/** Bucket and field names are lowercase, underscored identifiers. */
const IDENTIFIER = /^[a-z][a-z0-9_]*$/;

/** No item or monster name is anywhere near this long. */
const MAX_LITERAL_LENGTH = 200;

export class BucketQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BucketQueryError';
  }
}

/**
 * Rejects anything that is not a plain identifier.
 *
 * Bucket and field names are ours, not the visitor's, so this is defence in
 * depth rather than the main control — but a feature that builds a field name
 * from a URL segment is an easy mistake, and this makes it fail immediately
 * instead of composing a query the wiki will happily parse.
 */
function assertIdentifier(kind: string, name: string): void {
  if (!IDENTIFIER.test(name)) {
    throw new BucketQueryError(
      `Invalid ${kind} "${name}". Bucket ${kind}s are lowercase identifiers — ` +
        `introspect the schema rather than guessing (docs/api-notes/osrs-wiki-bucket.md).`,
    );
  }
}

/**
 * Escapes a value for a single-quoted Bucket string literal.
 *
 * ⚠️ SECURITY — this is the injection boundary (OWASP A03)
 *
 * Item names reach here from a search box, and the wiki parses what we send as
 * source code. All three behaviours below were verified against the live API
 * rather than assumed:
 *
 *   - A raw `'` terminates the literal → `')' expected near 's'`. Real names
 *     contain apostrophes constantly ("Verac's flail"), so stripping them is
 *     not an option and escaping is mandatory.
 *   - `\'` is accepted and yields a literal apostrophe.
 *   - `\\` is accepted and yields a literal backslash.
 *
 * **Backslash must be escaped before the quote, and this ordering is the whole
 * point.** An escaper that only handles `'` lets a value ending in `\` turn our
 * own closing quote into an escaped one, so the literal runs on into the rest
 * of the expression and the caller controls the query from there. Reversing
 * these two lines reintroduces exactly that.
 *
 * Control characters are rejected rather than escaped: a newline inside a
 * literal is a parse error (`unfinished string`), no legitimate value contains
 * one, and refusing beats inventing an escape sequence we have not verified.
 */
export function escapeLiteral(value: string): string {
  if (value.length > MAX_LITERAL_LENGTH) {
    throw new BucketQueryError(
      `Value too long (${value.length} > ${MAX_LITERAL_LENGTH}).`,
    );
  }

  // Written as escapes so the characters this rejects are not themselves
  // pasted into the source.
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    throw new BucketQueryError('Value contains control characters.');
  }

  return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
}

function literal(value: string | number | boolean): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new BucketQueryError(`Non-finite number in query: ${value}`);
    }
    return String(value);
  }

  if (typeof value === 'boolean') return String(value);

  return `'${escapeLiteral(value)}'`;
}

/**
 * Builds the chained expression the `query` parameter expects.
 *
 * Pure and exported so the escaping above is testable without a network call —
 * which matters more here than in most modules, because a regression in it is
 * silent rather than noisy.
 */
export function buildBucketQuery({
  bucket,
  select,
  where = [],
  limit,
}: BucketQuerySpec): string {
  assertIdentifier('bucket', bucket);

  if (select.length === 0) {
    throw new BucketQueryError('select() must name at least one field.');
  }
  for (const field of select) assertIdentifier('field', field);
  for (const [field] of where) assertIdentifier('field', field);

  const parts = [
    `bucket('${bucket}')`,
    `.select(${select.map((f) => `'${f}'`).join(',')})`,
    ...where.map(([field, value]) => `.where('${field}',${literal(value)})`),
  ];

  if (limit !== undefined) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new BucketQueryError(`limit must be a positive integer, got ${limit}.`);
    }
    parts.push(`.limit(${limit})`);
  }

  parts.push('.run()');
  return parts.join('');
}

interface BucketResponse<T> {
  bucket?: T[];
  /** Present instead of `bucket` on a bad query — and HTTP 200 either way. */
  error?: string;
}

/**
 * Runs a query and returns the rows.
 *
 * Note the wiki answers a malformed query with **HTTP 200** and an `error`
 * field, so `osrsFetch`'s status check does not catch it. Without the explicit
 * check below a typo'd field name would surface as an empty result set — the
 * hardest kind of bug to spot, because "no data" looks like a legitimate answer.
 *
 * Cached for a day by the `wiki` source default: this data changes on weekly
 * game updates, not continuously.
 */
export async function runBucketQuery<T>(spec: BucketQuerySpec): Promise<T[]> {
  const query = buildBucketQuery(spec);

  const body = await osrsFetch<BucketResponse<T>>('wiki', '', {
    searchParams: { action: 'bucket', format: 'json', query },
  });

  if (body.error) {
    throw new BucketQueryError(`Wiki rejected the query: ${body.error}\n  ${query}`);
  }

  return body.bucket ?? [];
}

/**
 * Unwraps a possibly-repeated field. See `Repeatable`.
 *
 * Returning null for an empty array rather than `undefined` keeps "the field is
 * absent" and "the field is present but empty" indistinguishable at call sites,
 * which is correct — neither gives us a value.
 */
export function firstValue<T>(field: Repeatable<T>): T | null {
  if (Array.isArray(field)) return field[0] ?? null;
  return field ?? null;
}

/** Repeated numeric fields arrive as strings (`["1127"]`). */
export function firstNumber(field: Repeatable<string | number>): number | null {
  const value = firstValue(field);
  if (value === null || value === '') return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/* --- Typed helpers over the buckets we have verified ---------------------- */

export interface WikiItem {
  item_name: string;
  item_id: Repeatable<string>;
  high_alchemy_value: number | null;
  buy_limit: number | null;
  value: number | null;
  is_members_only: Repeatable<string>;
  examine: Repeatable<string>;
}

const ITEM_FIELDS = [
  'item_name',
  'item_id',
  'high_alchemy_value',
  'buy_limit',
  'value',
  'is_members_only',
  'examine',
] as const;

/**
 * Item metadata by exact name.
 *
 * Returns an array: variant pages ("Rune platebody" vs its ornamented forms)
 * produce multiple rows. Callers wanting one row should filter on
 * `default_version` rather than taking `[0]` and hoping.
 *
 * For prices and buy limits prefer `prices.ts`'s `/mapping` — it is one bulk
 * request covering every item, where this is one request per name.
 */
export async function fetchWikiItem(name: string): Promise<WikiItem[]> {
  return runBucketQuery<WikiItem>({
    bucket: BUCKETS.item,
    select: ITEM_FIELDS,
    where: [['item_name', name]],
    limit: 10,
  });
}

export interface WikiMonster {
  name: string;
  combat_level: number | null;
  hitpoints: Repeatable<string | number>;
  max_hit: Repeatable<string | number>;
  attack_level: number | null;
  strength_level: number | null;
  defence_level: number | null;
  magic_level: number | null;
  ranged_level: number | null;
  stab_defence_bonus: number | null;
  slash_defence_bonus: number | null;
  crush_defence_bonus: number | null;
  magic_defence_bonus: number | null;
  range_defence_bonus: number | null;
  attack_speed: number | null;
  size: number | null;
  elemental_weakness: Repeatable<string>;
  elemental_weakness_percent: Repeatable<string | number>;
}

const MONSTER_FIELDS = [
  'name',
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
  'range_defence_bonus',
  'attack_speed',
  'size',
  'elemental_weakness',
  'elemental_weakness_percent',
] as const;

/**
 * Monster combat stats — the DPS calculator's entire data dependency.
 *
 * Always an array, and often more than one row: Zulrah returns three (one per
 * form), each with different defences. That is data, not duplication, so this
 * does not collapse it — a DPS calculator has to let the user choose the form.
 */
export async function fetchWikiMonster(name: string): Promise<WikiMonster[]> {
  return runBucketQuery<WikiMonster>({
    bucket: BUCKETS.monster,
    select: MONSTER_FIELDS,
    where: [['name', name]],
    limit: 20,
  });
}

export interface WikiEquipmentBonuses {
  page_name: string;
  equipment_slot: string | null;
  combat_style: string | null;
  stab_attack_bonus: number | null;
  slash_attack_bonus: number | null;
  crush_attack_bonus: number | null;
  range_attack_bonus: number | null;
  magic_attack_bonus: number | null;
  stab_defence_bonus: number | null;
  slash_defence_bonus: number | null;
  crush_defence_bonus: number | null;
  range_defence_bonus: number | null;
  magic_defence_bonus: number | null;
  strength_bonus: number | null;
  ranged_strength_bonus: number | null;
  magic_damage_bonus: number | null;
  prayer_bonus: number | null;
  weapon_attack_speed: number | null;
  weapon_attack_range: string | null;
}

const BONUS_FIELDS = [
  PAGE_NAME,
  'equipment_slot',
  'combat_style',
  'stab_attack_bonus',
  'slash_attack_bonus',
  'crush_attack_bonus',
  'range_attack_bonus',
  'magic_attack_bonus',
  'stab_defence_bonus',
  'slash_defence_bonus',
  'crush_defence_bonus',
  'range_defence_bonus',
  'magic_defence_bonus',
  'strength_bonus',
  'ranged_strength_bonus',
  'magic_damage_bonus',
  'prayer_bonus',
  'weapon_attack_speed',
  'weapon_attack_range',
] as const;

/**
 * Equipment bonuses for one item.
 *
 * Keyed by `page_name` because this bucket has **no item-name field of its
 * own** — the page is the join. For an item whose page differs from its name,
 * resolve the page first.
 */
export async function fetchWikiEquipmentBonuses(
  pageName: string,
): Promise<WikiEquipmentBonuses[]> {
  return runBucketQuery<WikiEquipmentBonuses>({
    bucket: BUCKETS.bonuses,
    select: BONUS_FIELDS,
    where: [[PAGE_NAME, pageName]],
    limit: 10,
  });
}

export interface WikiQuest {
  page_name: string;
  official_difficulty: string | null;
  official_length: string | null;
  requirements: string | null;
  items_required: string | null;
  start_point: string | null;
}

const QUEST_FIELDS = [
  PAGE_NAME,
  'official_difficulty',
  'official_length',
  'requirements',
  'items_required',
  'start_point',
] as const;

/**
 * Quest metadata.
 *
 * ⚠️ The text fields are **wiki prose, not structured data** — `requirements`
 * is a human sentence, not a machine-readable skill list. A quest planner that
 * needs "level 40 Mining" as a number has to parse it, and that parsing is a
 * feature's problem, not this client's.
 *
 * Note there is no `name` field; quests are identified by `page_name`.
 */
export async function fetchWikiQuests(limit = 200): Promise<WikiQuest[]> {
  return runBucketQuery<WikiQuest>({
    bucket: BUCKETS.quest,
    select: QUEST_FIELDS,
    limit,
  });
}
