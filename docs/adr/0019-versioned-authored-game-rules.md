# ADR-0019: Authored game rules are versioned, sourced and confidence-graded data

- **Status:** Accepted
- **Date:** 2026-07-26
- **Deciders:** Utility feature agent (Phase B)

## Context

Every other data source in this app was **measured**. The prices client, the
Wise Old Man client and the Wiki Bucket client were all probed against live
endpoints, and [`docs/api-notes/`](../api-notes/) records what came back —
including the surprises, like a bad Bucket query returning HTTP 200 with an
`error` field.

The Utility feature group has no such luxury. Four of its five PRD §3.7 items
rest on facts that **no API publishes**:

| Fact                                     | Source available       |
| ---------------------------------------- | ---------------------- |
| Daily/weekly reset times                 | OSRS Wiki prose only   |
| Items kept on death, skull, Protect Item | OSRS Wiki prose only   |
| Minigame points per game                 | OSRS Wiki prose only   |
| The 0.6s game tick                       | Universally documented |

[ADR-0007](./0007-api-first-no-code-redistribution.md) already settled that
where no API exists we implement from published formulas rather than copying
someone's source. That tells us _how_ to get the rule into the repo. It does not
tell us what to do about the fact that we are now the weakest link: a
transcribed number has no provenance, no freshness, and no way for the next
reader to tell a carefully checked fact from a half-remembered one.

This matters more than it sounds. These rules **change**. Jagex has reworked
wilderness death mechanics more than once (Death's Office, the untradeable
reclaim rework). A death-risk calculator encoding a superseded rule is worse
than no calculator at all, because a player trusts it and loses a bank. And a
hard-coded `3` in a function body is invisible when the rules move — nobody
greps for `3`.

The failure mode is not "we got a number wrong". It is "we got a number wrong,
presented it with total confidence, and left no way to find out which numbers
were ever checked."

## Decision

We will represent every authored game rule as **data, not literals**, and every
rule record will carry three fields beyond its value:

1. **`confidence`** — one of `documented` (stated on the OSRS Wiki),
   `community` (widely agreed by players, no primary source), or `unverified`
   (modelled, explicitly not confirmed).
2. **`source`** — where the value came from, in prose, next to the value.
3. A module-level **version string** (`RESET_RULES_VERSION`,
   `DEATH_RULES_VERSION`, `MINIGAME_DATA_VERSION`), bumped on any change and
   **rendered in the UI**.

And, the part that gives the grading teeth:

4. **The UI renders anything below `documented`.** A rule we are unsure about
   is badged on the card, and a minigame with a player-reported table says so
   above the answer. A confidence field that only the source code can see is a
   comment with extra steps.

We will also **state what is not modelled** rather than approximating it. The
death-risk page lists Death's Office reclaim costs, killer-side value,
item-specific exceptions and the Ultimate Ironman case as explicitly out of
scope, because a confidently wrong number is worse than a missing one.

A reviewer can check compliance mechanically: a new rule with no `source`, or a
guess shipped as `documented`, fails review.

## Consequences

### Good

- **Auditable.** When the wilderness is next reworked, `DEATH_RULE_CLAUSES` is
  a checklist. Someone can walk the list against the wiki in ten minutes,
  without reading a line of calculator logic.
- **Honest to the user.** A player can see that the Void costs are
  player-reported and the Pest Control point table is not, and weigh a
  ten-hour grind accordingly. This is the same instinct as surfacing
  `player.updatedAt` on the roster: staleness stated, not implied.
- **Testable as data.** `minigames.test.ts` asserts that every minigame has a
  source and a valid confidence, and `death-risk.test.ts` does the same for
  every clause. A future contributor cannot add an unsourced rule and get a
  green build.
- **Cheap.** Three extra fields and a string. No dependency, no schema, no
  build step.

### Bad

- **`confidence` is a judgement, and judgements rot.** Nothing forces a
  re-review, so a `documented` rule can quietly become false while still
  claiming a source. The version string makes the staleness visible but does
  not fix it.
- **It is more verbose** than `const KEPT_ITEMS = 3`, and the verbosity buys
  nothing on the day it is written — only later.
- **Grading invites false precision.** Three levels are a coarse instrument;
  the boundary between `community` and `unverified` is a matter of taste, and
  two authors will draw it differently.
- **Rendering uncertainty costs trust.** A calculator that hedges reads as less
  authoritative than one that does not, even when it is more accurate. We are
  accepting a worse first impression for a better second one.

### Neutral

- Other feature slices with authored rules — combat formulas above all, where
  [ADR-0007](./0007-api-first-no-code-redistribution.md) already commits us to
  implementing published maths ourselves — should follow this shape. The DPS
  calculator's golden-file tests are the complementary control: this ADR is
  about provenance, golden files are about arithmetic.
- Creates follow-on work: nothing currently prompts a periodic re-review of a
  rule set. A dated `reviewed` field is a natural next step if these datasets
  grow.

## Alternatives considered

| Alternative                                 | Why not chosen                                                                                                                                                                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Plain constants with a comment              | Comments are invisible to the user and to any test. Nothing stops the next contributor adding an unsourced number, and nothing tells a player which figures were checked.                                                            |
| Scrape the wiki at build time               | Prose, not structured data — the `quest` bucket is the proof that the wiki's own structured layer does not cover this. A scraper over prose is a parser for a format nobody promised to keep. Fails hard rule #8's spirit.           |
| Ship only what we are certain of            | Would drop the monthly cadence and Castle Wars entirely. Tempting, and it is what we did for the reward tables we could not source — but omitting a useful tool because it is 90% certain serves nobody, provided the 10% is stated. |
| A `rules` table in Postgres                 | No writer, no editor, no auth to build one behind (ADR-0012), and it moves the rules away from the tests that check them. Version control is already the right store for data that changes on a game update.                         |
| Present everything as equally authoritative | The status quo of most OSRS calculators, and the reason players cross-check them. It is also the failure this ADR exists to prevent.                                                                                                 |

> The rejected wiki-scraper is the one worth remembering. It looks like the
> "proper" engineering answer — automated, always fresh — and it is a trap for
> exactly the reason `osrsbox-db` was rejected in
> [ADR-0004](./0004-reject-osrsbox-db.md): a data pipeline that silently stops
> being correct is more dangerous than a hand-written one that visibly is not.

## Revisit if

- The OSRS Wiki exposes these rules through the Bucket API as structured data,
  at which point measurement beats transcription and the `confidence` field
  collapses to one value.
- The rule sets grow past roughly fifty clauses, where prose sources stop being
  reviewable by reading and want a dated `reviewed` field per clause.
- A user-visible incident traces to a stale rule — evidence that surfacing
  confidence is not enough on its own and re-review needs to be forced.
