# ADR-0004: Use the OSRS Wiki Bucket API; reject osrsbox-db

- **Status:** Accepted
- **Date:** 2026-07-24
- **Deciders:** PRD §2.2, §2.9

## Context

Combat, skilling and quest tools need static game data: item stats, alch values,
buy limits, monster combat stats and drop tables.

`osrsbox-db` is the answer most sources give. It is the top search result, is
widely recommended in forum posts and tutorials, and **its own README states it
is "updated after every weekly game update."**

Checking the GitHub API directly: **last commit 2021-09-30, last push
2022-08-07.** The project is roughly five years stale. The README's claim is
simply false, and every secondary source repeats it.

Meanwhile the OSRS Wiki has replaced its deprecated Semantic MediaWiki `ask`
endpoint with **Bucket**, a queryable semantic layer. Verified live:

- `bucket('infobox_item')` returns `item_id`, `high_alchemy_value`, `buy_limit`,
  `value`, `weight`, `tradeable`, `is_members_only` and more.
- `bucket('infobox_monster')` exposes **55 fields**, including every combat stat
  a DPS calculator needs — all defence bonuses, `max_hit`, `attack_speed`,
  `flat_armour`, `elemental_weakness`.

## Decision

**We will use the OSRS Wiki Bucket API as the source for all static game data,
and we will not use osrsbox-db.**

Because the data is near-static, we fetch it **at build time** rather than per
request, which removes Bucket from the runtime path and sidesteps its
undocumented rate limits.

**Field names must be introspected, never guessed.** Verified failures:
`highalch`, `high_alch` and `monster_name` are all wrong; the real names are
`high_alchemy_value` and `name`. Introspect with
`action=parse&page=Bucket:Infobox monster&prop=wikitext`.

## Consequences

### Good

- Data is officially maintained and updates with the game.
- Avoids shipping a database missing five years of items, bosses and gear.
- One source covers items, monsters and (pending verification) quests.
- No GPL entanglement — osrsbox-db is GPL-3.0.

### Bad

- Bucket is newer and less documented than a static dataset; field names are
  non-obvious and the schema can change under us.
- `item_id` is a _repeated_ field (arrays, for item variants), so consumers must
  handle arrays rather than scalars.
- Multi-version pages (Zulrah's forms) need `version_anchor` / `default_version`
  handling or naive queries return duplicate rows.
- Build-time fetching means a game update requires a redeploy to reflect.
- **Unverified:** rate limits, and whether quest/equipment/drop-table buckets
  exist (PRD §9.1/V9).

### Neutral

- Wiki content is CC BY-NC-SA; attribution required, and commercial use is
  foreclosed (PRD §9.1/V6).

## Alternatives considered

| Alternative                          | Why not chosen                                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| **osrsbox-db**                       | **Five years stale.** The failure mode is silent wrong answers, not errors — recent content would simply be absent. |
| **Scraping wiki pages**              | Fragile, rude, and unnecessary now that Bucket exists for exactly this.                                             |
| **Hand-maintaining our own dataset** | Full control, but a permanent maintenance burden that would rot the same way osrsbox-db did.                        |
| **osrsreboxed (community fork)**     | Fresher than the original but still a volunteer fork with the same structural risk.                                 |

## Revisit if

- Bucket lacks a needed data category (V9) → hand-author _that category only_,
  not a wholesale switch.
- The Wiki deprecates Bucket as it did Semantic MediaWiki.

## Note for future readers

This is the clearest case in the project of why verification beats recall. The
popular answer, the project's own README, and search-result summaries **all
agreed with each other and were all wrong.** Any agent working from training
data alone would have chosen osrsbox-db. Check `pushed_at` before trusting a
data source's freshness claim.
