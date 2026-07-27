# Documentation index

Living documentation for the OSRS Clan Toolkit. Kept in sync **as work happens**,
not written up at the end.

## Start here

| Doc                                                          | Purpose                                                                                      |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| [`/PRD.md`](../PRD.md)                                       | Product requirements, feature catalog, per-feature data source investigation                 |
| [`/CLAUDE.md`](../CLAUDE.md)                                 | **Living context** — loaded into every AI session. Current state, hard rules, open questions |
| [`api-terms.md`](./api-terms.md)                             | **Binding** third-party API terms and our compliance rules                                   |
| [`environment.md`](./environment.md)                         | Every `.env.local` value — where to get it, why it exists, how to verify it                  |
| [`theming.md`](./theming.md)                                 | Design tokens, dark mode, do/don't                                                           |
| [`../src/components/README.md`](../src/components/README.md) | Atomic design, defined for this app                                                          |

## Architecture Decision Records

Written **at the time of decision, in the same PR that implements it** — never
retroactively. A retroactive ADR records rationalisation, not reasoning: the
alternatives genuinely weighed are forgotten within days, and those are the most
valuable part.

| ADR                                                               | Title                                         | Status                 |
| ----------------------------------------------------------------- | --------------------------------------------- | ---------------------- |
| [0000](./adr/0000-template.md)                                    | Template                                      | —                      |
| [0001](./adr/0001-serverless-nextjs-architecture.md)              | Serverless Next.js with managed Postgres      | Accepted               |
| [0002](./adr/0002-delegate-tracking-to-wise-old-man.md)           | Delegate player tracking to Wise Old Man      | Accepted               |
| [0003](./adr/0003-price-history-depth.md)                         | Accept the 365-point price history ceiling    | Accepted               |
| [0004](./adr/0004-reject-osrsbox-db.md)                           | Use the Wiki Bucket API; reject osrsbox-db    | Accepted               |
| [0005](./adr/0005-rsn-verification-method.md)                     | Officer approval for RSN↔Discord linking      | ~~Superseded by 0012~~ |
| [0006](./adr/0006-hosting-tier-and-scheduled-jobs.md)             | Defer hosting choice; record constraints      | **Deferred**           |
| [0007](./adr/0007-api-first-no-code-redistribution.md)            | API-first; no third-party code redistribution | Accepted               |
| [0008](./adr/0008-tailwind-v4-css-first-theming.md)               | Tailwind v4 CSS-first token theming           | Accepted               |
| [0009](./adr/0009-atomic-design-conventions.md)                   | Atomic design conventions, enforced by lint   | Accepted               |
| [0010](./adr/0010-no-discord-bot.md)                              | No Discord bot — OAuth only                   | ~~Superseded by 0012~~ |
| [0011](./adr/0011-third-party-api-compliance.md)                  | Compliant, non-commercial API consumption     | Accepted               |
| [0012](./adr/0012-no-authentication-public-read-only.md)          | **No authentication — public, read-only app** | Accepted               |
| [0013](./adr/0013-rate-limiting-shared-store.md)                  | Rate limiting by hashed IP in shared Postgres | Accepted               |
| [0014](./adr/0014-economy-bulk-only-data-access.md)               | Economy reads bulk price feeds only           | Accepted — amended     |
| [0015](./adr/0015-combat-engine-from-published-formulas.md)       | Combat engine from published wiki formulas    | Accepted               |
| 0016                                                              | _(Skilling — lands with PR #4)_               | **Not yet on `main`**  |
| [0017](./adr/0017-partial-clue-dataset-with-derivable-solvers.md) | Partial clue dataset; derivable solvers       | Accepted               |
| 0018                                                              | _(Quests — lands with PR #6)_                 | **Not yet on `main`**  |
| [0019](./adr/0019-versioned-authored-game-rules.md)               | Versioned, sourced, confidence-graded rules   | Accepted               |

Numbers **0016 and 0018 are reserved, not missing** — their ADRs exist on the
unmerged `feat/skilling` and `feat/quests` branches. Do not reuse those numbers.

**To add one:** copy [`0000-template.md`](./adr/0000-template.md), take the next
number, and **add a row above in the same commit**. The `write-adr` skill
automates this.

**What warrants an ADR:** data source choices, architecture, auth/session model,
database choice, licensing, and any reversal of an earlier ADR (supersede —
never edit history).

## API notes

Empirically verified upstream behaviour, recorded because provider docs were
incomplete or **wrong** in several places. Each states the date verified.

| Doc                                                            | Covers                                             |
| -------------------------------------------------------------- | -------------------------------------------------- |
| [`osrs-wiki-prices.md`](./api-notes/osrs-wiki-prices.md)       | Endpoints, the 365-point cap, mandatory User-Agent |
| [`osrs-wiki-bucket.md`](./api-notes/osrs-wiki-bucket.md)       | Query syntax, verified schemas, field-name traps   |
| [`jagex-hiscores.md`](./api-notes/jagex-hiscores.md)           | Response shape, missing CORS, coverage gaps        |
| [`wise-old-man-groups.md`](./api-notes/wise-old-man-groups.md) | Anonymous group reads, `roleOrders`, roster shape  |

## Evidence discipline

Claims about external systems carry a tag:

- **[VERIFIED]** — the endpoint was actually called and the behaviour observed.
- **[DOCUMENTED]** — stated in the provider's docs, not independently exercised.
- **[UNVERIFIED]** — could not confirm; must be checked before being designed against.

**This applies to proposed solutions too, not just upstream claims.** The v1.0
PRD review caught a mitigation resting on an unconfirmed API capability while
every other claim was carefully tagged. A fix that depends on an unverified
capability is an unverified fix.

## Keeping docs in sync

Updating `CLAUDE.md` is part of the **definition of done** for any change that
alters architecture, adds a data source, or resolves an open question. A PR that
changes architecture without updating it is incomplete.

Stale context is worse than no context — it actively misleads both humans and
agents.
