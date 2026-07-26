# Testing guide

`npm run check` (typecheck → lint → format → test) is the gate. It must pass
before any branch is proposed for merge; CI runs the same thing with **no
secrets**, deliberately, so nothing may require `.env.local` to be populated.

## Two test projects, split by file extension

Configured in [`vitest.config.ts`](../vitest.config.ts).

| Project | Files               | Environment | For                                      |
| ------- | ------------------- | ----------- | ---------------------------------------- |
| `logic` | `src/**/*.test.ts`  | node        | Pure domain logic in `lib/`. Fast.       |
| `ui`    | `src/**/*.test.tsx` | jsdom       | Component rendering via Testing Library. |

The split exists because jsdom costs roughly an order of magnitude more startup
time per file, and most of this repo is pure maths. **Name the file for what it
tests:** a calculator's formulas go in `.test.ts`, its form goes in `.test.tsx`.

Run one project: `npx vitest run --project=ui`.

## Logic tests — the higher-value half

Every calculator is a pure function in `src/lib/<feature>/` (see
[`components/README.md`](../src/components/README.md) rule 3). That is what makes
this possible, and it is where the real bugs live.

- **Test the maths, not the wiring.** A GE-tax function tested at the threshold,
  one above, one below, and at the cap is worth more than twenty render tests.
- **Golden-file tests where "looks about right" is indistinguishable from
  wrong** — the DPS calculator especially. Pin values to the official
  calculator, record where each expectation came from in a comment, and treat a
  diff as a real failure rather than something to re-baseline.
- **Test the boundaries the upstream imposes**, not just the happy path: the
  365-point `/timeseries` cap, a Bucket error returned as HTTP 200, `gained`
  returning fewer rows than `memberCount`.
- **Never hit a live API in a test.** Stub `fetch` (`vi.stubGlobal`) or the
  client module. A test that needs the network is not a unit test and will fail
  in CI, which runs without secrets and should not depend on the Wiki being up.

## UI tests — what is actually worth asserting

Reference implementation: [`src/components/atoms/Button.test.tsx`](../src/components/atoms/Button.test.tsx).

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
```

**Query by role and accessible name**, not by test id or class:

```tsx
screen.getByRole('button', { name: 'Calculate' });
screen.getByRole('spinbutton', { name: 'Buy price' });
```

This is not stylistic. A query by role fails when a control loses its label,
which is the accessibility bug you actually want caught. `getByTestId` passes
happily on a control no screen reader can name.

**Do assert:**

- Rendered output for given props — the number a user reads is the product.
- Interaction results: type a price, expect the computed margin on screen.
- Empty, loading and error states. `TableEmptyRow` exists so empty is _stated_.
- Disabled/invalid states, and that an invalid input does not produce `NaN` on
  screen. Users paste `1,000` and `1k` into number fields constantly.

**Do not assert:**

- Tailwind class strings. That is a copy of the implementation, and it fails on
  every restyle while catching nothing. The rare exception is a class carrying
  real behaviour — `.tabular` on a numeric column.
- Colours or theme values. The token system is tested by existing, not per use.
- Anything already covered by a `lib/` logic test. Test the formula once, in
  `.test.ts`, then test that the component displays what it is handed.

**Use `userEvent`, not `fireEvent`.** `userEvent` dispatches the full sequence a
real browser does (pointerdown, focus, keydown, input…), so it catches handlers
wired to the wrong event. Remember `await` — every `userEvent` call is async.

## Server Components

`render()` cannot execute an async Server Component. Keep the fetch in
`app/**/page.tsx` and pass data down as props, which the conventions already
require — then test the presentational component with plain props, and test the
fetching function separately as logic. If a page component is hard to test, that
is usually the layering telling you something.

## Coverage expectations for a feature slice

A feature is not done until it has all four:

1. Pure logic in `src/lib/<feature>/` — unit tested, including edge cases.
2. Interactive organism — rendering and interaction tested.
3. Empty/error/invalid-input states — tested.
4. `npm run check` green.
