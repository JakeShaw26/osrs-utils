# OSRS Clan Toolkit

A clan-scoped hub of Old School RuneScape utility tools — Grand Exchange,
combat, skilling, clues, quests and clan leaderboards — with Discord sign-in and
rank-gated views.

> **Status: foundation scaffold.** No features are implemented. The only working
> endpoint is `/api/health`. See [`CLAUDE.md`](./CLAUDE.md) for current state.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill it in
npm run dev
```

`.env.local` needs a Postgres URL, Discord OAuth credentials and a User-Agent
string before the app will boot — [`src/lib/env.ts`](./src/lib/env.ts) validates
at startup and fails loudly rather than 500-ing later.

### Database

```bash
npm run db:generate   # generate migrations from the schema
npm run db:migrate    # apply them
npm run db:studio     # browse
```

### Checks

```bash
npm run check   # typecheck + lint + format
```

Lint enforces the atomic-design layering and blocks direct `fetch()` to OSRS
hosts — those are correctness rules, not style preferences.

## Documentation

| Doc                                                      | Purpose                                                              |
| -------------------------------------------------------- | -------------------------------------------------------------------- |
| [`PRD.md`](./PRD.md)                                     | Requirements, feature catalog, per-feature data source investigation |
| [`CLAUDE.md`](./CLAUDE.md)                               | Living context: current state, hard rules, open questions            |
| [`docs/README.md`](./docs/README.md)                     | Documentation index                                                  |
| [`docs/adr/`](./docs/adr/)                               | Architecture Decision Records                                        |
| [`docs/theming.md`](./docs/theming.md)                   | Design tokens and dark mode                                          |
| [`docs/api-notes/`](./docs/api-notes/)                   | Verified upstream API behaviour                                      |
| [`src/components/README.md`](./src/components/README.md) | Atomic design conventions                                            |

## Stack

Next.js (App Router) · TypeScript · Tailwind v4 · Drizzle + Postgres ·
Auth.js (Discord) · Vercel

## A few rules worth knowing before you write code

1. Call OSRS APIs only through `osrsFetch()` — it sets the User-Agent the Wiki
   requires.
2. Use the **pooled** Postgres connection in serverless routes.
3. Never fan out requests across clan members in a request path.
4. Authorisation is server-side and deny-by-default; role checks fail **closed**.
5. Use semantic tokens (`bg-surface-raised`), never raw colours.
6. **Never use `osrsbox-db`** — it looks authoritative and is 5 years stale.

Full rationale in [`CLAUDE.md`](./CLAUDE.md).

## Licence

Undecided — see [ADR-0007](./docs/adr/0007-gpl-dps-formulas.md). Reusing the
official Wiki DPS calculator's GPL-3.0 formulas would likely require this
repository to be GPL-3.0.

Game data from the [OSRS Wiki](https://oldschool.runescape.wiki) under
CC BY-NC-SA 4.0. Not affiliated with Jagex.
