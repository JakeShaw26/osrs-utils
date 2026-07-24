# ADR-0008: Tailwind v4 with CSS-first, two-layer token theming

- **Status:** **Accepted — confirmed by the repository owner (2026-07-24)**
- **Date:** 2026-07-24
- **Deciders:** Scaffolding pass (AI), confirmed by repository owner

> The deviation from the original brief (`tailwind.config.ts` → CSS-first
> `@theme`) was flagged for confirmation and **the owner confirmed Tailwind v4
> is what they want.** No further action; this is settled.

## Context

The scaffolding brief specified Tailwind CSS with design tokens defined "as
Tailwind theme extensions in `tailwind.config.ts`".

Checking the registry during scaffolding: **`tailwindcss@4.3.3` is current**
(`v3-lts` is `3.4.19`). Tailwind v4 is **CSS-first** — tokens are declared in a
`@theme` block in the stylesheet, and `tailwind.config.ts` is the v3 pattern.
v4 can still load a JS config via the `@config` directive, but that exists for
migrating v3 projects, not for greenfield ones.

So the brief and current best practice conflict. Per the brief's own
instruction — _"if you find a gap or contradiction, don't silently resolve it,
flag it and write an ADR"_ — this is that ADR.

A second, independent problem: "define tokens" underspecifies the thing that
actually decays. A palette alone does not stop a component written in month
three using `bg-slate-900` while a day-one component uses `bg-surface-raised`.
The failure mode is drift, not absence.

## Decision

**We will use Tailwind v4 with CSS-first configuration.** No
`tailwind.config.ts`. Tokens live in `@theme` in `src/app/globals.css`.

**We will structure tokens in two layers:**

1. **Raw palette** (`--osrs-slate-900`, `--osrs-gold-400`) — never referenced by
   a component.
2. **Semantic tokens** (`--surface-raised`, `--content-muted`, `--profit`) —
   the only layer components may use.

Semantic tokens are exposed with `@theme inline` so Tailwind emits `var()`
references rather than resolving at build time. That is what allows `.dark` to
re-point them at runtime, and it is why **no component contains a `dark:`
variant or a theme conditional**.

We additionally define **domain tokens** (`profit`, `loss`, `members`) separate
from status tokens (`success`, `danger`), because a falling item price is not an
error state.

Dark is the default theme (resolution order: user choice → OS → dark).

## Consequences

### Good

- Matches the current Tailwind major; no migration debt from day one.
- Light/dark costs nothing per component — one class is correct in both themes.
- Rebranding or a contrast fix is a one-file edit.
- Semantic names make review easy: `bg-slate-900` in a diff is obviously wrong,
  whereas a raw hex is easy to wave through.

### Bad

- **Deviates from the written brief.** Anyone expecting `tailwind.config.ts`
  will not find it. Mitigated by this ADR, a note in `postcss.config.mjs`, and
  `docs/theming.md`.
- Two layers are more indirection than a flat palette. The payoff only arrives
  as the app grows — which is precisely when a flat palette has already rotted.
- CSS-first config is newer, so third-party Tailwind plugins assuming a JS
  config may need the `@config` bridge.
- Tailwind v4 requires a modern-browser baseline. Acceptable: the audience runs
  a current browser alongside a game client.

### Neutral

- `prettier-plugin-tailwindcss` needs `tailwindStylesheet` pointed at
  `globals.css` instead of a config path.

## Alternatives considered

| Alternative                                       | Why not chosen                                                                                                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Tailwind v3 + `tailwind.config.ts` as briefed** | Literal compliance, but starts a greenfield repo one major behind with a migration already owed. The brief's intent was consistent tokens, and CSS-first delivers that better. |
| **v4 + `@config` bridge to a JS file**            | Satisfies the letter of the brief while adding a compatibility shim built for migrations. Worst of both.                                                                       |
| **Flat semantic palette, no raw layer**           | Simpler, but every palette change becomes a find-and-replace across semantic names, and there is nowhere to keep a coherent colour ramp.                                       |
| **CSS Modules / styled-components**               | Rejected by the brief, and correctly: utilities keep spacing and colour decisions visible in review.                                                                           |

## Revisit if

- A dependency requires a JS Tailwind config (use `@config`, keep tokens in CSS).
- Token count grows enough that a single `globals.css` becomes unwieldy; split
  into imported CSS partials, keeping the two-layer structure.
