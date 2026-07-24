# OSRS Clan Toolkit

A hub of Old School RuneScape utility tools for one clan — Grand Exchange,
combat, skilling, clues, quests and clan leaderboards.

**No sign-in.** The app is public and read-only; the clan is identified by its
Wise Old Man group, so every tool is a shareable URL
([ADR-0012](./docs/adr/0012-no-authentication-public-read-only.md)).

> **Status: foundation scaffold.** No features are implemented. The only working
> endpoint is `/api/health`. See [`CLAUDE.md`](./CLAUDE.md) for current state.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill it in
npm run dev
```

`.env.local` needs a Wise Old Man group ID, a Postgres URL and a User-Agent
string — [`src/lib/env.ts`](./src/lib/env.ts) validates on first use and fails
loudly, naming the variable, rather than 500-ing later.

### Database

```bash
npm run db:generate   # generate migrations from the schema
npm run db:migrate    # apply them
npm run db:studio     # browse
```

### Checks

```bash
npm run check   # typecheck + lint + format + tests
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

Next.js (App Router) · TypeScript · Tailwind v4 · Drizzle + Postgres · Vercel

## A few rules worth knowing before you write code

1. Call OSRS APIs only through `osrsFetch()` — it sets the User-Agent the Wiki
   requires.
2. Use the **pooled** Postgres connection in serverless routes.
3. Never fan out requests across clan members in a request path.
4. **No public write path.** There is no auth, so every request is untrusted;
   only `CRON_SECRET`-authenticated jobs may write.
5. Anything proxying an upstream API needs rate limiting and a shared cache
   before it ships — otherwise we are an open proxy and get IP-blocked.
6. Use semantic tokens (`bg-surface-raised`), never raw colours.
7. **Never use `osrsbox-db`** — it looks authoritative and is 5 years stale.

Full rationale in [`CLAUDE.md`](./CLAUDE.md).

## Licence

Undecided — see
[ADR-0007](./docs/adr/0007-api-first-no-code-redistribution.md). We call APIs
and copy no third-party source, which keeps the choice open.

Game data from the [OSRS Wiki](https://oldschool.runescape.wiki) under
CC BY-NC-SA 4.0. Not affiliated with Jagex.
