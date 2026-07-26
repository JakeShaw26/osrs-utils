# Component conventions

Atomic design, defined for **this** app. Generic definitions ("an atom is the
smallest unit") are too vague to settle real arguments, so the tests below are
phrased in terms of our own features.

```
src/components/
├── atoms/       indivisible; no child components; no data
├── molecules/   a few atoms doing one job
├── organisms/   a complete, meaningful section of a page
└── templates/   layout and slots; no data
```

Pages live in `src/app/` — in atomic-design terms, a route is the "page" layer.

## Which layer?

Work down the list and stop at the first "yes".

| Ask                                       | Yes →       |
| ----------------------------------------- | ----------- |
| Does it render other components of ours?  | Not an atom |
| Is it meaningful alone on a page?         | Organism    |
| Does it only arrange slots, with no data? | Template    |
| Does it combine 2–4 atoms for one job?    | Molecule    |
| Otherwise                                 | Atom        |

### Worked examples from our feature catalog

| Component                     | Layer        | Why                                                                  |
| ----------------------------- | ------------ | -------------------------------------------------------------------- |
| `PriceTag`                    | **Atom**     | Renders one value. Splitting it further leaves nothing               |
| `StatBadge`                   | **Atom**     | A label/value pill. Used by combat, skilling and clan features alike |
| `ItemSearchInput`             | **Atom**     | A styled input. The _dropdown_ makes it a molecule                   |
| `PriceChangeIndicator`        | **Molecule** | `PriceTag` + `StatBadge`, one job: show movement                     |
| `ItemPicker`                  | **Molecule** | Input + results list                                                 |
| `ThemeToggle`                 | **Molecule** | Small, self-contained, interactive                                   |
| `FeatureCard`                 | **Organism** | Stands alone; a grid of these _is_ the tool directory                |
| `FlippingCalculatorForm`      | **Organism** | Owns inputs, calls domain logic, renders results                     |
| `ClanLeaderboard`             | **Organism** | A complete page section over pre-aggregated data                     |
| `CalculatorLayout`            | **Template** | Title/tool/notes slots. Fetches nothing                              |
| `app/tools/flipping/page.tsx` | **Page**     | Fetches, authorises, composes                                        |

**The recurring judgement call** is molecule vs organism. Our tiebreaker: _would
this appear in a design review as its own item?_ `ClanLeaderboard` yes,
`LeaderboardRow` no.

## Rules

These are enforced by ESLint (`eslint.config.mjs`), not just documented.

1. **Imports only from your own layer or below.** An atom importing a molecule is
   a lint error. If an atom needs another component, it was never an atom.
2. **Atoms, molecules and templates never fetch.** No `@/lib/db`, no `@/lib/api`.
   Data is fetched in `app/` and flows down as props. Organisms may receive data
   but should not fetch it themselves.
3. **Domain logic lives in `src/lib/`.** `formatGp` is in `lib/utils`, not inside
   `PriceTag`, so it is testable without rendering. Applies to every calculator:
   the maths is a pure function; the component only displays its result.
4. **Semantic tokens only.** No `bg-[#1a1a1a]`, no `text-slate-400`. Use
   `bg-surface-raised`, `text-content-muted`. See [`docs/theming.md`](../../docs/theming.md).
5. **`"use client"` goes on the smallest leaf that needs it.** Interactivity
   forces the boundary; putting it on a page drags the whole subtree into the
   bundle. `ThemeToggle` is the worked example — the page rendering it stays a
   server component.

## What already exists — check here before writing one

Shared primitives, built in Phase A specifically so parallel feature work does
not produce five slightly different inputs.

| Component                                       | Layer    | Notes                                                                       |
| ----------------------------------------------- | -------- | --------------------------------------------------------------------------- |
| `Button`                                        | Atom     | `primary` / `secondary` / `ghost`                                           |
| `Input`                                         | Atom     | `numeric` right-aligns + `.tabular`. **Renders no label** — supply your own |
| `Select`                                        | Atom     | Native `<select>`; `options` array, optional `placeholder`                  |
| `Table`, `TableHead`, `TableBody`, `TableRow`,  | Atom     | Primitives, not a data table. `numeric` on every GP/XP/level cell           |
| `TableHeaderCell`, `TableCell`, `TableEmptyRow` |          | `TableEmptyRow` so empty states are stated, not implied                     |
| `PriceTag`, `StatBadge`                         | Atom     | Single values                                                               |
| `PriceChangeIndicator`, `ThemeToggle`           | Molecule |                                                                             |
| `FeatureCard`                                   | Organism |                                                                             |
| `CalculatorLayout`                              | Template |                                                                             |

If one of these is close but not quite right, extend it rather than forking it —
a second near-identical input is how a token system quietly stops being one.

## Adding a component

1. Pick the layer with the table above.
2. Use tokens, never raw values.
3. Server component unless it needs state, effects or event handlers.
4. Keep logic in `lib/`, presentation in the component.
5. Write a `.test.tsx` beside it — see [`docs/testing.md`](../../docs/testing.md).
6. Run `npm run check` — layering violations fail the lint step.

## Testing components

Component tests are `.test.tsx` and run under jsdom; logic tests are `.test.ts`
and run under node. Query by role and accessible name, never by class or test
id. Full guidance and the reasoning behind what is and is not worth asserting:
[`docs/testing.md`](../../docs/testing.md). Reference: [`atoms/Button.test.tsx`](./atoms/Button.test.tsx).
