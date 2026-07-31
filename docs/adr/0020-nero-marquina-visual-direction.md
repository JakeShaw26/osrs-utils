# ADR-0020: Nero Marquina visual direction, with light mode first-class

- **Status:** **Accepted — chosen by the repository owner (2026-07-31)**
- **Date:** 2026-07-31
- **Deciders:** Repository owner, from four directions explored by an AI agent

## Context

The app shipped 27 routes on a token system ([ADR-0008](./0008-tailwind-v4-css-first-theming.md))
that was never designed so much as accumulated. A design-system project
(`83afccbd-460f-4655-863e-264658472345`, 14 cards) inventoried the existing UI —
48 components, both themes, rendered from real markup and real token values —
and explored four marble/OSRS palette directions, each a complete token set
applied to the same page fragment.

Facts that constrained the choice, all observed in that comparison rather than
reasoned from theory:

- **This app is dense numeric tables.** Its colour carries meaning: `profit`,
  `loss`, `success`, `danger` are semantic tokens, not decoration
  ([ADR-0008](./0008-tailwind-v4-css-first-theming.md) separates domain tokens
  from status tokens for exactly this reason).
- **A tinted ground competes with those tokens.** Of the four directions, only
  B (Nero Marquina) has a chromatically neutral ground. On C's green surface a
  green profit figure is a smaller perceptual step than a red loss figure, so
  gains read quieter than losses — a semantic defect wearing a palette's
  clothes.
- **Light-mode `--primary: #b47c17` reads brown, and not by accident.** It must
  be that dark to carry **white** `primary-content` at 4.5:1. Pairing true gold
  `#c9a227` with near-black content clears 7:1 — brighter _and_ more accessible.
  Dark mode already gets this for free.
- **There is no auth** ([ADR-0012](./0012-no-authentication-public-read-only.md)),
  so we cannot remember a theme preference server-side. Every visitor arrives on
  whatever their OS prefers. Light mode is not a minority path we control.
- **All four directions kept Layer 2 semantic names unchanged**, so this is a
  re-point of Layer 1, not a re-architecture.

## Decision

**We will adopt direction B, Nero Marquina** — cool neutral ground
(`#eeeff0` light / `#0b0b0c` dark), black marble with white veining, brand gold
unchanged — by re-pointing **Layer 1 only** in `src/app/globals.css`. Semantic
token names do not change, so no component changes to re-skin all 27 routes.

**We will treat light mode as first-class, not a fallback.** Marble texture,
sprite contrast and the inventory-slot treatment must be verified in both
themes. Dark remains the _default_ (resolution order: user choice → OS → dark,
per ADR-0008); first-class means light is designed and checked, not preferred.

**We will apply the gold fix regardless of direction:** light-mode `--primary`
becomes `#c9a227` with near-black `primary-content`.

Two rules this direction creates, both enforceable by review:

- **Texture never goes behind data.** Veining is permitted on `surface` and
  chrome, **never** behind `surface-raised` where numbers live. Veining varies
  contrast _per glyph_, which WCAG cannot measure and an audit will not catch.
- **Feature sprites are illustrations, not glyphs.** Fixed-palette 32-grid
  sprites are not tintable, so they may never carry state through colour — state
  lives on the container. UI chrome stays single-path `currentColor` glyphs.
  Sprites render at integer scales only (16/32/48/64); **24 must be refused by
  the size prop**, because it is the size habit reaches for and it lands the
  grid on fractional device pixels.

## Consequences

### Good

- Colour budget goes to the data and the gold. On a neutral ground, `profit` and
  `loss` are the most saturated things on screen, which is where a tool's colour
  should go.
- The re-skin is one file. Layer 2 names are unchanged, so the checkpoint after
  re-pointing Layer 1 shows all 27 routes restyled with no component diff — a
  cheap place to stop and reject.
- The gold fix raises contrast while making the button brighter, so accessibility
  and appearance move the same way for once.
- Both themes get designed, which the no-auth model effectively requires anyway.

### Bad

- **B is the most conservative of the four and the least "OSRS".** C was the
  distinctive one. We are trading character for legibility, deliberately, and
  anyone hoping the redesign would make the app _feel_ like RuneScape will find
  it mostly still feels like a spreadsheet with good taste.
- **First-class light roughly doubles the redesign surface** — every texture,
  slot and contrast check happens twice. Dark-first would have halved it and
  made this ADR's direction choice matter much less.
- **The two-tier icon system is a permanent constraint, not a phase.** Every
  future icon needs a decision about which tier it belongs to, and mixing tiers
  at the same size looks like a rendering bug rather than a style choice.
- **`feTurbulence` is CPU-rasterised and re-rasterises on resize.** Painted
  carelessly across a full-page background it is a real performance cost.
- Reversing this after page-level layout work lands is expensive; reversing it
  after the Layer 1 re-point is nearly free. Sequence accordingly.

### Neutral

- Sprites must be original art drawn to OSRS's icon grammar. Vendoring Jagex
  PNGs breaks [hard rule #9 / ADR-0007](./0007-api-first-no-code-redistribution.md)
  and hotlinking the Wiki CDN breaches [`docs/api-terms.md`](../api-terms.md).
- Sprite delivery is one `<defs>` sheet in the root layout with `<use href>` at
  call sites; inlining seven sprites into 27 routes is dead weight.
- Sprites need a `<title>`, not `aria-hidden`, unless a visible label already
  says the same word.
- **De-duplicating the numeric field should happen before the re-skin**, not
  after: three near-identical fields means restyling the input three times and
  getting it subtly wrong twice.

## Alternatives considered

| Alternative                                           | Why not chosen                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C · Verde Antico**                                  | The genuinely close one, and the prettiest — reads as stone _and_ as RuneScape. Its green ground weakens the green `profit` signal. Fixable by pushing `profit` to a brighter emerald, but it breaks something the others never touch. **It wins if the app's centre of gravity moves from tables to browsing and discovery**, where character matters more than signal separation. |
| **A · Carrara & Gold**                                | Closest to classic marble and pleasant, but warm greys make the amber `warning` token muddy — a status token losing distinctness is the same class of problem as C's, in a less-used token.                                                                                                                                                                                         |
| **D · Travertine & Parchment**                        | The most OSRS-native (quest-scroll parchment) and tempting for that reason alone. Lowest contrast headroom of the four, and the warm ground eats `border`, which dense tables lean on hardest.                                                                                                                                                                                      |
| **Keep the current palette, apply only the gold fix** | Cheapest and genuinely defensible — the gold fix is the highest-payoff change and is direction-independent. Rejected because the current palette was accumulated rather than designed, and the comparison made its incoherence visible.                                                                                                                                             |
| **Dark-first, light as a supported fallback**         | Halves the work. Rejected because there is no auth and therefore no server-side theme memory, so a meaningful share of visitors land in light on first paint — and the gold fix, the single best finding, is a light-mode fix.                                                                                                                                                      |

## Revisit if

- Numeric tables stop being the app's centre of gravity — a browsing- or
  discovery-led app should reopen C.
- Real usage shows light mode is a rounding error (would justify demoting it and
  reclaiming half the redesign surface); we have no analytics today, so this is
  currently unmeasurable.
- `feTurbulence` shows up as a measured performance problem, in which case bake
  the veining to a static asset at build time rather than abandoning it.
- Jagex ever grants a sprite redistribution licence, which would retire the
  original-art constraint and the two-tier system with it.
