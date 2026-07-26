# OSRS Wiki Bucket API (static game data)

**Base:** `https://oldschool.runescape.wiki/api.php?action=bucket`
**Verified:** 2026-07-24, extended 2026-07-26 — queried live both times.

Client: [`src/lib/api/wiki-bucket.ts`](../../src/lib/api/wiki-bucket.ts). Build
queries with `buildBucketQuery()` — never string-concatenate one (see escaping).

Bucket is the Wiki's semantic data layer. It **replaces the deprecated Semantic
MediaWiki `action=ask`** endpoint.

## Query syntax

A chained expression passed as the `query` parameter:

```
bucket('infobox_item')
  .select('item_name','item_id','high_alchemy_value','buy_limit')
  .where('item_name','Rune platebody')
  .limit(1)
  .run()
```

Verified response:

```json
{
  "bucket": [
    {
      "item_id": ["1127"],
      "high_alchemy_value": 39000,
      "buy_limit": 70,
      "item_name": "Rune platebody"
    }
  ]
}
```

## ⚠️ Field names are not guessable — introspect first

Verified failures: `highalch`, `high_alch`, `monster_name` all return
`Field ... not found`. The real names are `high_alchemy_value` and `name`.

**Always read the schema before writing a query:**

```bash
curl --get "https://oldschool.runescape.wiki/api.php" \
  --data-urlencode "action=parse" \
  --data-urlencode "page=Bucket:Infobox monster" \
  --data-urlencode "prop=wikitext" \
  --data-urlencode "format=json"
```

## Verified schemas

**`infobox_item`:** `item_name`, `image`, `is_members_only`, `item_id`,
`examine`, `high_alchemy_value`, `league_region`, `release_date`,
`removal_date`, `value`, `weight`, `version_anchor`, `buy_limit`,
`default_version`, `quest`, `tradeable`

**`infobox_monster` (55 fields)** — enough to drive a DPS calculator with no
third-party monster database:

`name`, `id`, `combat_level`, `hitpoints`, `max_hit`, `attack_level`,
`strength_level`, `defence_level`, `ranged_level`, `magic_level`,
`stab/slash/crush/magic/range_attack_bonus`,
`stab/slash/crush/magic/range_defence_bonus`,
`light/standard/heavy_range_defence_bonus`, `attack_bonus`, `strength_bonus`,
`range_strength_bonus`, `magic_damage_bonus`, `attack_style`, `attack_speed`,
`flat_armour`, `size`, `slayer_level`, `slayer_experience`, `slayer_category`,
`assigned_by`, `elemental_weakness`, `elemental_weakness_percent`,
`freeze_resistance`, `poison_resistance`, `venom_immune`, `cannon_immune`,
`burn_immune`, `thrall_immune`, `attribute`, `experience_bonus`,
`is_members_only`, `release_date`, `version_anchor`, `default_version`

## ⚠️ The `query` parameter is a program, not a filter string

Verified 2026-07-26. Sending `Verac's flail` unescaped returns:

```json
{ "error": "')' expected near 's'." }
```

That is a **parser** error (Lua-shaped), which means an interpolated value is an
**injection surface**, not a formatting nuisance — and apostrophes are
unavoidable in OSRS item names.

Verified escaping behaviour:

| Input             | Result                                             |
| ----------------- | -------------------------------------------------- |
| `'` raw           | Parse error — literal terminates early             |
| `\'`              | ✅ Accepted, yields a literal apostrophe           |
| `\\`              | ✅ Accepted, yields a literal backslash            |
| `"…"` for a value | ✅ Accepted — double quotes work as an alternative |
| newline in value  | Parse error — `unfinished string near ''a'`        |

**Escape backslash first, then the quote.** Handling only `'` lets a value
ending in `\` escape our own closing quote and run on into the expression.
`escapeLiteral()` does this and is unit-tested for exactly that case; control
characters are rejected rather than escaped.

## ⚠️ A bad query returns HTTP 200

Errors arrive as `{"error": "…"}` with a 200 status, so a status check does not
catch them and a typo'd field name looks like an empty result set.
`runBucketQuery()` checks the field explicitly.

## `page_name` — the undocumented join key

Every bucket carries `page_name` (the source wiki page); it appears in no
published schema. It is the **only** key linking buckets — `infobox_bonuses` has
no item-name field at all, so equipment stats reach their item solely through it.

## Buckets that exist (V9, resolved 2026-07-26)

| Bucket                          | Exists | Notes                                                          |
| ------------------------------- | ------ | -------------------------------------------------------------- |
| `infobox_item`                  | ✅     | Item metadata                                                  |
| `infobox_monster`               | ✅     | 55 fields; enough for a full DPS calculator                    |
| `infobox_bonuses`               | ✅     | **Equipment stats** — full attack/defence bonuses              |
| `quest`                         | ✅     | Prose fields only, no `name` — keyed by `page_name`            |
| `drops` / `drop` / `item_drops` | ❌     | Not found under any obvious name. Drop tables remain unsourced |

**`infobox_bonuses` (18 fields):** `stab/slash/crush/range/magic_attack_bonus`,
`stab/slash/crush/range/magic_defence_bonus`, `strength_bonus`,
`ranged_strength_bonus`, `prayer_bonus`, `magic_damage_bonus` (DOUBLE),
`equipment_slot`, `weapon_attack_speed`, `weapon_attack_range`, `combat_style`.

**`quest` (9 fields):** `description`, `enemies_to_defeat`, `ironman_concerns`,
`items_required`, `official_difficulty`, `official_length`, `requirements`,
`start_point`, `json`.

⚠️ Quest fields are **wiki prose, not structured data** — `requirements` is a
human sentence. A quest planner needing "level 40 Mining" as a number has to
parse it, and that parsing is a feature's problem, not the client's.

## Gotchas

1. **`item_id` is `repeated`** — returns an **array**, not a scalar, because of
   item variants. Handle accordingly. So is **`max_hit`** (`["41"]`) and
   `hitpoints`, while `combat_level` is a plain number — which fields are
   repeated is **not predictable from meaning**. Unwrap with `firstValue()`.
2. **Multi-version pages** (Zulrah's forms, item variants) use `version_anchor`
   and `default_version`. Naive queries return duplicate rows; filter on
   `default_version` unless you specifically want all variants.
3. **Lowercase, underscored** bucket and field names.
4. `.select()` is required — an empty select errors.

## Rate limits

**Unverified.** Not stated on the Bucket documentation page. Standard MediaWiki
etiquette applies.

We sidestep this entirely by fetching **at build time** — the data is near-static
and changes only on weekly game updates. See
[ADR-0004](../adr/0004-reject-osrsbox-db.md).

## Not yet verified

**Drop tables.** No bucket found under `drops`, `drop` or `item_drops`. Drop
data may live in wikitext templates rather than Bucket, which would mean parsing
pages — worth weighing against skipping the feature (PRD V9, remaining part).
