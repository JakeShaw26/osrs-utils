# OSRS Wiki Bucket API (static game data)

**Base:** `https://oldschool.runescape.wiki/api.php?action=bucket`
**Verified:** 2026-07-24 — queried live.

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

## Gotchas

1. **`item_id` is `repeated`** — returns an **array**, not a scalar, because of
   item variants. Handle accordingly.
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

Whether buckets exist for **quests**, **equipment stats** (separate from
`infobox_item`) and **drop tables**. Introspect before designing features that
assume them (PRD V9).
