# ADR-0009: Atomic design folder conventions, enforced by lint

- **Status:** Accepted
- **Date:** 2026-07-24
- **Deciders:** Scaffolding pass (AI)

## Context

The PRD (§6.2) requires atomic design. The catalog is ~35 tools across economy,
combat, skilling, clues, quests and the clan layer, built over months, mostly by
one developer with AI assistance.

That last detail matters. The usual failure of atomic design is not that people
disagree with it but that **the boundaries are ambiguous**, so "is this a
molecule or an organism?" gets answered differently each week until the folders
are meaningless. AI agents make this worse: each session starts cold and will
re-derive the convention from whatever it sees nearby.

Two forces therefore matter more than the taxonomy itself:

1. **Unambiguous tests**, phrased in terms of our own features.
2. **Machine enforcement**, because a convention that only exists in prose is a
   suggestion.

There is also a Next.js interaction. React Server Components mean the
client/server split is a _second_ axis crossing the atomic one, and getting it
wrong is a real cost: a `"use client"` at page level pulls the entire subtree
into the bundle.

## Decision

**We will use `atoms / molecules / organisms / templates` under
`src/components/`, with `src/app/` routes serving as the "pages" layer.**

**We will resolve layer ambiguity with a first-match decision table**
(`src/components/README.md`) rather than prose definitions, with the tiebreaker
for the common molecule-vs-organism case: _would this appear in a design review
as its own item?_

**We will enforce the hierarchy with ESLint** (`eslint.config.mjs`) via
`no-restricted-imports`:

- Atoms may not import molecules, organisms or templates.
- Molecules may not import organisms or templates.
- **Atoms, molecules and templates may not import `@/lib/db` or `@/lib/api`.**

**Domain logic lives in `src/lib/`, never in components** — so calculator maths
is unit-testable without rendering. `formatGp` sits in `lib/utils`, not inside
`PriceTag`.

**`"use client"` goes on the smallest leaf that needs it.** Data fetching and
authorisation happen in `app/` and flow down as props.

A second lint rule blocks direct `fetch()` calls to OSRS hosts outside
`osrs-fetch.ts`, so the mandatory User-Agent cannot be bypassed.

## Consequences

### Good

- Layering violations fail CI instead of surviving review.
- The no-data-fetching-in-components rule keeps atoms and molecules trivially
  reusable and testable, and naturally keeps them server-renderable.
- New contributors (human or AI) can copy a worked example per layer.
- Domain logic in `lib/` means calculators can be tested without a DOM — which
  matters most for combat maths, where wrong output looks plausible (PRD §3.2).

### Bad

- More upfront ceremony than colocating components by feature. For a handful of
  tools this would be overkill; the bet is on the catalog's size.
- The decision table will still produce arguable calls at the margin. It bounds
  the ambiguity rather than eliminating it.
- Cross-cutting components (a leaderboard row used in three contexts) can sit
  awkwardly between molecule and organism.
- `no-restricted-imports` patterns must be updated if paths are ever renamed.

### Neutral

- Feature-specific organisms currently live alongside shared ones. If a feature
  accumulates several, consider `organisms/<feature>/` — a naming change, not a
  structural one.

## Alternatives considered

| Alternative                                       | Why not chosen                                                                                                                                  |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Feature-first folders** (`features/flipping/…`) | Better colocation, but the PRD mandates atomic design, and with ~35 small tools sharing many primitives the shared layer is where the value is. |
| **Atomic design, documented but unenforced**      | The default, and the reason atomic design so often decays. Documentation does not survive month three.                                          |
| **Flat `components/` with naming conventions**    | Lower ceremony, no enforceable boundary, and no answer to "may this fetch data?"                                                                |
| **Add `pages/` under components**                 | Redundant — `src/app/` already is that layer, and duplicating it invites confusion about where routing lives.                                   |

## Revisit if

- A single feature grows enough organisms that the shared folder is noisy →
  namespace within `organisms/`.
- We adopt a component library with its own conventions → keep it in
  `components/ui/`, outside the hierarchy.
- Lint rules produce more false positives than caught mistakes.
