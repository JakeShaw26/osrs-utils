# ADR-0015: Combat engine implemented from published wiki formulas, over committed data

- **Status:** Accepted
- **Date:** 2026-07-26
- **Deciders:** Combat feature agent (Phase B)
- **Implements:** [ADR-0007](./0007-api-first-no-code-redistribution.md) for the one
  feature that ADR explicitly could not reach

## Context

[ADR-0007](./0007-api-first-no-code-redistribution.md) established that we call
APIs and copy no third-party source, and named DPS as the single place that
policy has no answer: **there is no DPS-calculation API.** The official
calculator at `tools.runescape.wiki/osrs-dps/` is a client-side GPL-3.0
application. It has no endpoint, and reading its source to obtain either code
_or_ reference numbers is exactly what ADR-0007 forbids.

The PRD (§3.2) calls this the highest-complexity feature in the product and the
one where "looks about right" is indistinguishable from wrong.

Two questions had to be answered to build it:

1. **Where do the formulas come from**, given no code may be copied?
2. **Where do monster and equipment stats come from at request time**, given the
   app is public, has no auth, and must not become an open proxy in front of the
   wiki (PRD §5.3, hard rules 4 and 5)?

## Decision

### 1. Formulas are transcribed from the wiki's documented combat maths

Every constant and every step is taken from the OSRS Wiki's **prose and maths
pages**, read 26 July 2026:

| Page                                       | What it supplied                                           |
| ------------------------------------------ | ---------------------------------------------------------- |
| `Maximum melee hit`                        | Effective strength, base damage, gear multiplier table     |
| `Maximum ranged hit`                       | Ranged effective strength, void tiers, gear multipliers    |
| `Maximum magic hit`                        | Spell base hits, damage-bonus application order            |
| `Damage per second/Melee`                  | Attack roll, defence roll, hit chance, average damage      |
| `Damage per second/Ranged`                 | Ranged accuracy prayers (distinct from the damage prayers) |
| `Damage per second/Magic`                  | Magic effective level, magic defence roll                  |
| `Temporary skill boost/<skill>`            | Potion boost formulas                                      |
| `Calculator:Magic/Powered staves/Template` | Powered-staff max-hit formulas                             |

Every table in [`src/lib/combat/constants.ts`](../../src/lib/combat/constants.ts)
names its page. Game mechanics are facts, not copyrightable expression; no
calculator source was read.

### 2. The wiki contradicts itself, and the published outcome breaks the tie

`Maximum melee hit` writes effective strength as
`⌊(level + style + 8) × prayer⌋`. `Damage per second/Melee` writes it as
`⌊level × prayer⌋ + style + 8`. **These are not the same number** — at 99
Strength with Piety and an Aggressive stance they differ by 3, which is a full
point of maximum hit.

The same article states a concrete outcome: the free-to-play maximum hit is 31,
with a rune 2h sword, amulet of strength, decorative boots (gold), a strength
potion and Ultimate Strength. With the Bucket-sourced strength bonuses for those
three items (+70, +10, +1):

- DPS-page ordering → `⌊111 × 1.15⌋ = 127; +3 +8 = 138` → **31** ✅
- Max-hit-page ordering → `⌊122 × 1.15⌋ = 140` → **32** ❌

**We follow the DPS pages**, and that case is pinned as the suite's one
[PUBLISHED] golden test. When two documented orderings disagree, a published
outcome decides.

### 3. Golden tests are tiered, and the tiers are labelled honestly

We could not drive the official calculator to harvest reference numbers, so
`max-hit.test.ts` labels every expectation with where it came from:

- **[PUBLISHED]** — the wiki states this outcome in prose. There is **one**, and
  it is worth more than the rest combined.
- **[GAME FACT]** — a universally known property that pins a specific term. A
  level-1 unarmed player hits 1, which is only true if the `+320` rounding term
  exists; drop it and a new account can never deal damage.
- **[DERIVED]** — hand-worked from the cited formula, with the arithmetic
  written out in the comment so a reviewer verifies it with a calculator rather
  than trusting the code.

**[DERIVED] cases prove we implement the documented formula, not that the
documented formula matches the game.** That is the honest limit of what this
suite establishes, and it is stated in the test file header as well as here.

### 4. Data is pre-aggregated into the repo, so no route touches an upstream

`node scripts/generate-combat-data.mjs` makes **two** Bucket requests, filters to
a curated list, and writes
[`src/lib/combat/data/`](../../src/lib/combat/data/). The calculators are pure
functions over those files.

Consequences, all of them the point:

- **No fan-out.** A loadout is eleven items; resolving them per request would be
  eleven upstream calls (hard rule 4).
- **No open proxy.** Nothing a stranger can do here reaches the wiki, so no
  rate limiter is needed — pre-aggregation is the first line of defence and the
  only one required (PRD §5.3, ADR-0013).
- **No secrets, no database.** The whole feature works with an empty
  `.env.local`, which is how CI runs.
- The cost is that a game update needs the generator re-run by hand. The data
  changes weekly at most, and a stale number is visible in a diff.

### 5. Saved loadouts live in `localStorage`

There is no sign-in, so there is no account to own a saved loadout and no
trusted write path to accept one (ADR-0012, hard rules 5 and 6). Loadouts are
stored as _names_ — item names, potion names — rather than resolved bonuses, so
a saved setup picks up corrected stats after a regeneration instead of being
frozen at whatever the numbers were the day it was saved.

## What is deliberately NOT modelled

Listed because an unstated omission is indistinguishable from a bug, and every
one of these makes our number **lower** than the true one rather than higher:

- **Special attacks** of any kind.
- **Weapon-specific scaling:** Twisted bow vs high Magic, Tumeken's shadow
  tripling gear magic bonuses, Osmumten's fang's accuracy re-roll and its
  0.15×–0.85× damage range, Scythe of Vitur's three hits, Dark bow.
- **Bolt and dart procs** (ruby, diamond, dragonstone).
- **Elemental weakness**, `flat_armour`, and defence reduction over a fight.
- **Obsidian / Berserker necklace (1.3), Inquisitor's on crush (1.025),
  Castle wars bracelet (1.2)** — the multipliers are in the wiki table but there
  is no gear slot wired to them. `extraMultiplier` is the manual hatch.
- **Augury's magic damage bonus and elite void magic's damage bonus** —
  `Damage per second/Magic` documents neither, and inventing a value is the
  failure this ADR exists to avoid. `extraMagicDamagePercent` is the hatch.
- **The monster fighting back.** Time-to-kill assumes uninterrupted attacks.

## Known uncertainty

`Damage per second/*` gives average damage on a landed hit as
`maxHit/2 + 1/(maxHit + 1)`, the extra term being there because the page states a
damage roll of 0 on a successful attack is raised to 1. **This is the one term
we could not corroborate outside those pages.** It is worth 0.1% at a maximum
hit of 40 and 10% at a maximum hit of 4 — negligible for the boss loadouts the
tool is aimed at, material for a low-level one. Implemented as documented and
flagged in `dps.test.ts`.

## Consequences

### Good

- The formulas are testable without rendering, and 85 logic tests cover them.
- No secrets, no database, no upstream call, no rate limiter — the feature is
  deployable as static output.
- The engine is shared: max hit, DPS and loadout comparison are one code path,
  so they cannot disagree with each other.

### Bad

- **A game update silently invalidates both the formulas and the data.** The
  generator has to be re-run and the constants re-read; nothing detects this
  automatically.
- The equipment list is curated (~107 items). An item nobody added is simply
  absent, and the failure mode is "not in the dropdown".
- Our DPS understates any loadout whose weapon has special scaling, which is
  most best-in-slot weapons. Stated on the page rather than hidden.

## Revisit if

- A maintained DPS **API** appears → prefer it (ADR-0007 already says so).
- The golden tests drift from community-accepted numbers → treat as a defect and
  re-read the formula pages, not the expectations.
- The curated equipment list becomes the main complaint → generate the whole
  `infobox_bonuses` bucket and load it per slot instead of bundling it.
