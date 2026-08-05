# ADR-0023: Retire the hand-drawn sprite system

- **Status:** Accepted
- **Date:** 2026-08-01
- **Deciders:** Repository owner (rejected the artwork), AI agent (the removal)
- **Reverses:** [ADR-0021](./0021-osrs-item-icons-by-id.md) → _"The seven
  hand-drawn `Sprite`s stay — they name tool groups (Economy, Combat…), which no
  single item icon represents."_

## Context

[ADR-0020](./0020-nero-marquina-visual-direction.md) established a two-tier icon
system: `Sprite` for fixed-palette illustrations, `Icon` for `currentColor`
glyphs. Seven sprites were drawn — coins, scimitar, anvil, clue, star, shield,
hourglass — and the owner **rejected them on quality**, which is what started the
item-icon work in ADR-0021.

ADR-0021 kept them anyway, on one argument: they name _tool groups_, and no
single item icon represents "Economy" or "Skilling". That argument was reasonable
when written and did not survive contact with the data.

### What changed

- **The tool groups now carry item ids.** `TOOL_GROUPS` was the sprites' only
  caller. With it re-pointed, `Sprite`, `SpriteSheet`, `sprites.ts` and the
  `.sprite` CSS palette had no reader anywhere in the app.
- **A tradeable item does stand in for each group**, once you accept a stand-in
  rather than a symbol: gold bar, dragon scimitar, casket, rune pickaxe, papyrus,
  prayer potion. Six distinct silhouettes and six distinct hues, checked rendered
  at 36px in both themes rather than assumed.
- **Keeping them had a running cost.** Rejected artwork that ships is worse than
  no artwork: every future contributor has to be told the sprites are disliked,
  and a component nothing calls still gets maintained, tested and read.

## Decision

**Delete the sprite system.** `src/components/atoms/Sprite.tsx`,
`Sprite.test.tsx`, `SpriteSheet.tsx`, `src/lib/ui/sprites.ts`, the `SpriteSheet`
render in `app/layout.tsx`, and the fixed-hex `.sprite` palette in `globals.css`
all go. `Icon` (tier two) is untouched.

1. **`ItemIcon` is now the whole of tier one.** The two-tier system in ADR-0020
   survives — fixed-palette art that cannot carry state, versus `currentColor`
   glyphs that can. Only the tier-one component changed identity.
2. **`--sprite-slot` / `--sprite-slot-edge` keep their names.** They are the
   inventory slot, which `ItemIcon`'s `slotted` still needs, and renaming tokens
   would ripple through `theming.md` and `token-contrast.test.ts` for nothing.
   The name outliving the sprites is mild debt, recorded here rather than paid.
3. **Recovery, not rewrite.** The artwork and its documented pixel grammar are in
   commit **`77e990f`** — `git show 77e990f:src/components/atoms/SpriteSheet.tsx`.
   Follows the precedent set when the auth module was deleted (ADR-0012).

## Consequences

### Good

- **Nothing rejected ships.** The landing page shows the game's own art, which is
  what the owner asked for.
- **Four files, ~50 lines of CSS and 11 tests go.** Less surface, and one fewer
  icon concept to explain before someone can add a component.
- **The tool directory gained a real guard.** `tools.test.ts` now asserts every
  group's id has packed artwork — which immediately caught that **995 (Coins) and
  2677 (Clue scroll) have no icon**, because the icon set is built from the GE
  price mapping and both are untradeable. The sprite check it replaced could not
  have caught anything comparable.

### Bad

- **The group icons are stand-ins, not symbols.** A gold bar is not "Economy" and
  papyrus is not "Quests"; a purpose-drawn sprite could have been. This is the
  real cost of the decision, and it is only acceptable because the purpose-drawn
  ones were not good enough.
- **We are now fully dependent on the tradeable item set** for any pictorial
  vocabulary. Anything untradeable — quest capes, clue scrolls, diary rewards,
  skill icons — simply has no picture available.
- **Token names now lie slightly.** `--sprite-slot` styles a thing with no
  sprites left.

### Neutral

- ADR-0020's visual direction is unchanged. It still describes a `Sprite`
  component; like ADR-0008 naming `--osrs-slate-900`, it is a point-in-time
  record with a forward pointer, not a document to rewrite.

## Alternatives considered

| Alternative                               | Why not chosen                                                                                                                                                                     |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Keep `Sprite` for future non-item use** | The honest version of "just in case". Rejected: nothing calls it, the artwork is rejected, and git recovers it in one command. Dead code that documentation must keep explaining.  |
| **Redraw the seven sprites better**       | Solves the naming problem properly. Rejected on cost and on repeat risk — the first attempt was rejected, and nothing about the second would be more likely to land.               |
| **Use `Icon` glyphs for the groups**      | Already exists, tintable, no licensing question. Rejected: tier-two glyphs are UI chrome, and using them for feature identity collapses the distinction the whole system rests on. |

## Revisit if

- **A pictorial vocabulary is needed for something untradeable** — skills,
  quests, diary regions — since no item icon exists for any of them. That is the
  case that would justify redrawing sprites, and it should be judged on the
  artwork, not on the architecture.
- **The group stand-ins read badly to real users.** They were checked rendered,
  by one person, at one size.
