# Theming guide

All tokens live in [`src/app/globals.css`](../src/app/globals.css). There is **no
`tailwind.config.ts`** — Tailwind v4 is CSS-first. See
[ADR-0008](./adr/0008-tailwind-v4-css-first-theming.md) for why, including the
deviation from the original scaffolding brief.

## The two-layer system

The whole guide reduces to one idea:

```
Layer 1  --osrs-stone-900   raw palette    ← never referenced by a component
Layer 2  --surface-raised   what it MEANS  ← components use only this
```

The current palette is **direction B, Nero Marquina**
([ADR-0020](./adr/0020-nero-marquina-visual-direction.md)) — black marble with
white veining, on a deliberately **neutral** ground, because this app is dense
numeric tables and a tinted surface competes with the `profit`/`loss` tokens
that carry the meaning. Layer 1 was renamed `--osrs-slate-*` → `--osrs-stone-*`
in that change: nothing outside `globals.css` referenced it, which is the
clearest evidence the two-layer split works.

A component says `bg-surface-raised`, never `bg-slate-900`. Two consequences:

- **Light/dark needs no component changes.** `.dark` re-points the semantic
  tokens; components are unaware a theme exists. There is not a single
  `dark:` conditional in any component in this repo.
- **Rebranding is a one-file edit** rather than a repo-wide find-and-replace
  that misses a dozen places.

## Available tokens

### Surfaces — background layers, lightest to deepest

| Token             | Use                                  |
| ----------------- | ------------------------------------ |
| `surface`         | Page background                      |
| `surface-raised`  | Cards, panels sitting above the page |
| `surface-sunken`  | Wells, inputs, table headers         |
| `surface-overlay` | Modals, popovers, dropdowns          |
| `surface-hover`   | Hover state for interactive surfaces |

### Content — text and icons

| Token             | Use                                 |
| ----------------- | ----------------------------------- |
| `content`         | Primary text                        |
| `content-muted`   | Secondary text, descriptions        |
| `content-subtle`  | Placeholders, labels, disabled      |
| `content-inverse` | Text on a filled/primary background |

### Borders — `border`, `border-strong`

### Brand — `primary`, `primary-hover`, `primary-content`, `focus-ring`

`focus-ring` is separate from `primary` **because the brand gold cannot carry a
focus ring in light mode**: `#c9a227` on the light ground measures 2.1:1, under
the 3:1 WCAG 1.4.11 requires of a non-text indicator. The ring uses a darker
gold in light and the brand gold in dark. Never re-point it back to `primary`
"for consistency" — `src/test/token-contrast.test.ts` will fail, correctly.

### Status — `success`, `danger`, `warning`, `info`

### Domain — `profit`, `loss`, `members`

`profit`/`loss` are **not** aliases of `success`/`danger`, even though they
currently resolve to similar colours. A falling item price is not an error and a
rising one is not a success. Keeping them separate means we can restyle market
movement — or switch to a colourblind-safe up/down scheme — without touching
form validation states.

### Non-colour tokens

| Token                              | Use                         |
| ---------------------------------- | --------------------------- |
| `rounded-card` / `rounded-control` | Cards vs buttons and inputs |
| `shadow-card` / `shadow-overlay`   | Elevation                   |
| `text-2xs`                         | Small uppercase labels      |
| `font-mono` + `.tabular`           | Any changing number         |

**Use `.tabular` for every GP, XP or DPS value.** Proportional digits vary in
width, so figures jitter as they update and columns fail to align.

## Dark mode

**Dark is the default.** Not a toggle bolted on afterwards — the fallback when
no preference exists at all.

Reasoning: the audience skews heavily dark-mode. OSRS itself is a dark client,
RuneLite ships dark by default, and the tools this app replaces (Wise Old Man,
the Wiki's DPS calculator) are dark. A light default would flash white against
the game for most sessions.

Resolution order: **explicit user choice → OS preference → dark**.

An OS preference of light is still honoured; dark only wins when nothing is
known. Implemented in [`src/lib/theme/theme-script.tsx`](../src/lib/theme/theme-script.tsx)
as a **blocking inline script**, deliberately. Applying the class in a
`useEffect` would let the browser paint light first, producing a white flash on
every load — the exact thing a dark-first audience notices.

`ThemeToggle` flips the `.dark` class on `<html>` and stores the choice.

## Adding a token

1. If you need a new raw colour, add it to Layer 1 (`--osrs-*`) in `globals.css`.
2. Add the semantic token to **both** `:root` and `.dark`. Skipping `.dark`
   yields a token that silently looks wrong in the default theme.
3. Expose it in the `@theme inline` block so Tailwind generates utilities.
4. **Add it to `src/test/token-contrast.test.ts`** if it renders text or a focus
   indicator. That test parses `globals.css` and measures every pair in both
   themes; it is the only thing in the repo that can see a contrast ratio, since
   a component only knows it asked for `text-content-subtle`. Mid-tone greens
   and reds that pass on white commonly fail on a dark surface — that is why the
   dark theme uses the 400 variants rather than the 700s.
5. Document it in the tables above.

### Known contrast gap

`border-strong` against `surface-raised` is **1.9:1 light / 1.5:1 dark**, under
the 3:1 WCAG 1.4.11 asks for a control boundary. It predates the Nero Marquina
re-point (it was 2.0:1 / 1.5:1 before) and raising it makes every input read as
heavily outlined, so it is recorded here rather than quietly fixed. The test
deliberately does not assert it — a failing assertion nobody intends to fix
trains people to ignore the suite.

## Do / Don't

**1. Don't hardcode colour values**

```tsx
// ✗ invisible in the other theme; invisible to a find-and-replace
<div className="bg-[#171c25] text-[#eceef2]">

// ✓
<div className="bg-surface-raised text-content">
```

**2. Don't reach past the semantic layer to the raw palette**

```tsx
// ✗ "slate-900" says nothing about intent, and won't flip with the theme
<div className="bg-slate-900">

// ✓
<div className="bg-surface-raised">
```

**3. Don't write per-theme conditionals in components**

```tsx
// ✗ this is what the token system exists to prevent — and it multiplies
//   across every component until themes drift apart
<div className="bg-white dark:bg-slate-900 text-black dark:text-white">

// ✓ one class, correct in both themes
<div className="bg-surface-raised text-content">
```

**4. Do use domain tokens for domain meaning**

```tsx
// ✗ conflates "price went down" with "validation failed"
<span className="text-danger">▼ 3.2%</span>

// ✓
<span className="text-loss">▼ 3.2%</span>
```

**5. Do use `.tabular` for numbers that change**

```tsx
// ✗ digits shift width as the value updates
<span>{formatGp(price)}</span>

// ✓
<span className="tabular">{formatGp(price)}</span>
```

## Escape hatch

Arbitrary values (`bg-[#...]`, `w-[37px]`) are allowed only where Tailwind
genuinely cannot express the thing — a keyframe in a complex SVG animation, for
example. **Justify it in an inline comment** stating why a token won't work. An
unexplained arbitrary value is a review comment.
