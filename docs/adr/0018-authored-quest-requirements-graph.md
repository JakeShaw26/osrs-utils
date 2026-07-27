# ADR-0018: Author the quest requirements graph, and bound it by what is verified

- **Status:** Accepted
- **Date:** 2026-07-26
- **Deciders:** Quests feature agent
- **Relates to:** [ADR-0004](./0004-reject-osrsbox-db.md) (Bucket as the static
  data source), [ADR-0007](./0007-api-first-no-code-redistribution.md) (no code
  redistribution), [ADR-0012](./0012-no-authentication-public-read-only.md) (no
  auth, so no server-side personal state)

## Context

PRD §3.6 asks for a quest index, a "what can I do now?" solver and a diary
requirement checker. All three need the same thing: a **quest requirements
graph** — skill levels, quest points and prerequisite quests, as a dependency
DAG. Open question **V9** asked whether the wiki exposes one.

Two facts settle the shape of the feature before any of it is designed.

**First, completion is unknowable.** The Jagex hiscores carry no quest points,
no quest completion, no diaries and no combat achievements. This was verified by
enumerating all 90 activities in the live response
([`jagex-hiscores.md`](../api-notes/jagex-hiscores.md)). Skill _levels_, by
contrast, are fully available. So the feature can honestly answer "what could
you achieve from your levels" and can never answer "what have you done".

**Second, the wiki has quest data but not structured requirements.** Phase A
confirmed a `quest` bucket exists with nine fields, all wiki **prose**
([`osrs-wiki-bucket.md`](../api-notes/osrs-wiki-bucket.md)). Re-probing it for
this feature confirmed the `json` field is the same prose in a JSON wrapper —
there is no machine-readable requirements structure, and no quest-point field
at all.

But the prose is not opaque. The `requirements` string embeds the wiki's own
skill template markup:

```html
<span class="scp" data-skill="Mining" data-level="10" …></span>
```

and lists prerequisite quests as a bullet hierarchy, where the shallowest level
holds the direct prerequisites and deeper levels are the wiki spelling out
transitive ones for the reader:

```
* Completion of the following quests:
** [[Troll Stronghold]]
*** [[Death Plateau]]
```

So the data is extractable — but extraction is our inference over prose the wiki
never promised to keep parseable, not a contract.

## Decision

**Author the requirements graph as a checked-in dataset, derived from the wiki
at authoring time rather than fetched at runtime, and bound its coverage to
what has been verified rather than padding it out to look complete.**

Four parts.

### 1. The dataset is committed source, not a fetch

`src/lib/quests/quest-data.ts` and `diary-data.ts` are plain TypeScript
literals. Nothing about quests touches the network at request time.

This follows ADR-0004's "static game data is fetched at build time" to its
conclusion: quest requirements change on a game update, roughly never, and the
extraction involves judgement calls that should be reviewed by a human rather
than re-derived silently on every deploy. A parser that silently reinterprets
prose is a parser that silently gets it wrong after a wiki edit.

It is data extracted from an API, not third-party source code, so ADR-0007 is
satisfied — nothing is copied but facts about the game.

### 2. Coverage is partial, deliberate, and stated in the UI

**92 of ~191 quests are modelled**: all 23 free-to-play quests, 67 members'
quests that are prerequisites of others or common planning targets, and the 2
miniquests that gate a quest in that set.

A wrong prerequisite is worse than a missing one. A missing quest makes the
planner incomplete, which the UI can say; a wrong prerequisite makes it
confidently incorrect, which the member has no way to detect. So `QUEST_COVERAGE`
is exported and rendered on every quest surface, and a quest absent from the
list is described as _not modelled_, never as _not available_.

Adding quests is a data-only PR. `quest-data.test.ts` fails on a duplicate id, a
dangling prerequisite, a cycle, a redundant transitive edge, an unknown skill,
or a boostable flag on a skill the quest does not require.

### 3. Only solvable requirements go in `requirements`

Real requirements that cannot be evaluated from levels — "the ability to defeat
a level 195 Jungle Demon", "a trustworthy friend or partner", "access to
Morytania Graveyard" — are kept in a separate `otherRequirements` field which
the solver ignores **by construction** and the UI renders under "not checked by
this tool".

This is the single most important line in the data model. Folding those into
`requirements` would be impossible (they are not numbers); dropping them would
make the tool quietly claim a quest is startable when it is not. A test asserts
that no blocker can ever originate from `otherRequirements`.

Boosts are recorded per skill and displayed, but never assumed: we cannot know
whether a member has the potion, so a boostable requirement still reads as unmet.

### 4. Declared completion lives in the browser, and only there

There is no auth, so there is no user to key a row to and no way to authorise a
write (ADR-0012, hard rule #5). Declared quest and diary completions live in
`localStorage`, and export/import is a first-class part of the UI rather than a
hidden setting — ADR-0012 names it as the mitigation for the durability this
costs.

## Provenance

Captured 2026-07-26, ten requests total:

| Source                                              | Gives                                             |
| --------------------------------------------------- | ------------------------------------------------- |
| Bucket `quest` — `page_name`, `requirements`, …     | Skill levels, QP gates, prerequisite quests       |
| Rendered `Quests/Free-to-play` and `Quests/Members` | QP awarded, difficulty, length                    |
| Rendered diary pages ×12 (`class="diary-table"`)    | Per-tier diary skill, QP, combat and total levels |

Two cross-checks were run rather than assumed, and both are the reason the
numbers are trusted:

- The 23 free-to-play quests sum to **45** quest points, which reconciles with
  the wiki's stated free-to-play total of 46 once Tutorial Island's point is
  excluded. This is asserted in `quest-data.test.ts`.
- Every diary requirement cell carries its level **twice** — as a
  `data-skill-level` attribute and as cell text. The extraction required the two
  to agree and found **no disagreement across all 48 tiers**.

Ironman-only diary requirements (footnoted `Iron*`) are excluded: including them
would tell a normal account it cannot do something it can.

## Consequences

### Good

- **The solver is pure and fully testable.** No network, no database, no
  environment. The DAG, the blockers and the plan are unit-tested including
  cycle detection, which turns a data typo from a browser hang into a red test.
- **Correct where it speaks.** Every modelled requirement traces to a wiki
  field, not to recall.
- **Extending it is a reviewable data diff**, not a code change, and the
  integrity tests make a bad edit fail loudly.
- **The feature is honest by construction.** The type system separates what is
  knowable (levels) from what is asserted (completions) from what is real but
  uncheckable (`otherRequirements`).
- **Nothing about quests can rate-limit us**, because nothing about quests
  touches an upstream at request time.

### Bad

- **The dataset goes stale silently.** A new quest, or a requirement changed by
  a game update, will not appear until someone edits the file. There is no alarm
  for this. Mitigated only by the coverage figure being visible.
- **It is incomplete, visibly.** A member looking for Song of the Elves will not
  find it, and the page can only explain why.
- **Extraction was inference over prose.** It was hand-verified against the
  prose for all 92 quests and cross-checked twice, but the wiki never promised
  the markup would stay parseable, so a future refresh may need the extraction
  rules revisited.
- **Diary quest requirements are not modelled at all** — only skills, QP,
  combat and total level. A tier reported achievable may still be gated by a
  quest. Stated in the UI.

### Neutral

- **The hiscores prefill is optional.** It is server-proxied (the hiscores send
  no CORS header), rate-limited and cached per RSN for 5 minutes, and manual
  entry is a first-class path that always works. Removing it would cost
  convenience and nothing else.

## Alternatives considered

| Alternative                                         | Why not chosen                                                                                                                                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Parse the Bucket prose at build or request time** | The parsing involves judgement (which bullet depth is a direct prerequisite; which alternatives are real). Doing it silently on every build means a wiki edit changes our answers with no review. |
| **Model all ~191 quests by extraction, unverified** | Directly against the brief and against good sense: a wrong prerequisite makes the answer worse than no answer, and 191 entries cannot be hand-verified in one pass.                               |
| **Use a third-party quest-requirements dataset**    | ADR-0007 forbids copying third-party source, and the maintained ones are code rather than APIs. The same trap as `osrsbox-db` (ADR-0004) — authoritative-looking and quietly stale.               |
| **Skip the graph; show requirements as prose**      | That is the quest index alone, and the wiki already does it better. The DAG is the entire reason "what can I do now" is worth building.                                                           |
| **Store declared completions server-side**          | Impossible without auth, and a public write path is a defect (ADR-0012, hard rule #5).                                                                                                            |

## Revisit if

- Jagex or the wiki publishes structured quest requirements — then this becomes
  a fetch and the coverage limit disappears.
- The clan asks for quests the dataset does not cover; extending it is routine.
- The wiki changes its `scp` span markup, which would need the extraction rules
  in `quest-data.ts`'s header revisited before any refresh.
