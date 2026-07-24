# Theming guide

All tokens live in [`src/app/globals.css`](../src/app/globals.css). There is **no
`tailwind.config.ts`** — Tailwind v4 is CSS-first. See
[ADR-0008](./adr/0008-tailwind-v4-css-first-theming.md) for why, including the
deviation from the original scaffolding brief.

## The two-layer system

The whole guide reduces to one idea:

```
Layer 1  --osrs-slate-900   raw palette    ← never referenced by a component
Layer 2  --surface-raised   what it MEANS  ← components use only this
```

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

### Brand — `primary`, `primary-hover`, `primary-content`

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
4. Check contrast in both themes. Mid-tone greens and reds that pass on white
   commonly fail on a dark surface — that is why the dark theme uses the 400
   variants rather than 600.
5. Document it in the tables above.

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
