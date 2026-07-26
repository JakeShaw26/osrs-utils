# ADR-0017: Ship a partial clue dataset, and make the solvable clue types derivable

- **Status:** Accepted
- **Date:** 2026-07-26
- **Deciders:** Clues & Collection feature agent (Phase B)
- **Relates to:** [ADR-0004](./0004-reject-osrsbox-db.md) (Wiki Bucket as the
  static data source), [ADR-0007](./0007-api-first-no-code-redistribution.md)
  (copy no third-party source), [ADR-0012](./0012-no-authentication-public-read-only.md)
  (no auth, browser-local personal data),
  [ADR-0011](./0011-third-party-api-compliance.md) (API terms are binding)

## Context

The PRD calls the clue scroll solver **"the largest content-authoring task in
the product"** — thousands of steps across cryptic, map, anagram, emote, cipher,
coordinate and puzzle clues (§3.4). It suggests seeding from an existing openly
licensed dataset. Three constraints bear on that:

1. **ADR-0007 forbids copying third-party source into this repo**, and
   `docs/api-terms.md` is binding. Vendoring someone else's clue dataset is
   exactly the move that ADR rules out unless its licence is checked first, and
   no such check has been done.
2. **There is no clue data in the Wiki Bucket API.** Verified 2026-07-26 by
   listing every page in the Wiki's `Bucket` namespace (id `9592`): 47 buckets
   exist and **none of them holds clue steps**. So the Bucket route, which
   solved static game data everywhere else in this app, does not solve this.
3. **Authoring thousands of steps from memory produces wrong answers, not slow
   ones.** A wrong clue answer is undetectable to the member reading it — they
   run to the wrong city and blame themselves.

Two further facts, both measured in the same probe, changed the shape of the
rest of this feature group and are recorded here because they contradict what
`HANDOFF.md` and `CLAUDE.md` currently say:

- **`Bucket:Combat achievement` exists** and is fully structured: `id`, `name`,
  `monster`, `task`, `tier`, `type`, **646 rows**. The PRD's conclusion that the
  Combat Achievement task list must be hand-authored or dropped (§3.4) is
  therefore wrong. Only _completion_ is unavailable, not the catalogue.
- **`Bucket:Dropsline` and `Bucket:Drop table sources` exist**, which bears on
  open question **V9b** ("where do drop tables live, if not in a bucket?"). The
  existing note that no drop-table bucket exists is incorrect. Not used by this
  feature; flagged for whoever owns V9b.

Also confirmed: `Bucket:Collection log source` (`item_id`, `item_name`,
`sources`, `rates`, `kinds`) gives the collection log's _contents_, but nothing
anywhere gives a _player's_ collection log except TempleOSRS — whose terms are
unread because their docs return HTTP 403 (open question **V2**).

## Decision

**We will ship a deliberately partial clue dataset, and we will state its size
in the UI.** Specifically:

1. **Anagram and cipher clues are solved algorithmically, not looked up.** An
   anagram is its answer's letters rearranged and a cipher is its answer
   Caesar-shifted, so both reduce to a dictionary lookup over a list of names.
   The list (`src/lib/clues/npc-index.ts`, **86 names**) is what bounds coverage
   for these two types — not the number of catalogued steps. The solver answers
   anagrams and ciphers that appear nowhere in our step catalogue.
2. **Authored steps are a small, verifiable subset** (`src/lib/clues/dataset.ts`,
   **29 steps**: 18 anagram, 11 cryptic). Every entry links the Wiki page that
   confirms it. `emote`, `map`, `coordinate` and `puzzle` steps are **not
   covered at all**, and that is declared as data, not prose.
3. **The partialness is stated in numbers, in the UI, on every page**, computed
   from the dataset so it cannot go stale. A miss reads "not in our dataset —
   we hold 29 of the game's thousands" and links the Wiki, never a bare "no
   results".
4. **We will not vendor a third-party clue dataset**, and will not do so later
   without checking its licence first and recording the check.
5. **The Combat Achievement task list comes from the Wiki Bucket API**, cached a
   day and shared by every visitor. **Completion stays self-declared in
   `localStorage`**, is labelled unverified, feeds no leaderboard, and has
   export/import because browser storage is disposable (ADR-0012).
6. **We will not build against TempleOSRS** while V2 is open. The collection log
   route explains the blocker instead of stubbing the feature.

## Consequences

### Good

- **Coverage grows superlinearly for the derivable types.** Adding one name to
  the index can answer several anagram and cipher steps across every tier, at a
  fraction of the cost of transcribing them. The cheapest useful contribution is
  a one-line addition.
- **Authored anagrams are self-verifying.** Because an anagram is provably a
  rearrangement of its answer, `dataset.test.ts` checks every entry's letters
  against its answer. A typo fails the build rather than shipping a confidently
  wrong answer. Proofreading became a build step.
- **The solver makes no network request at all.** The dataset is a compile-time
  constant, so the page cannot become an open proxy, costs the Wiki nothing, and
  works with an empty `.env.local`.
- **The Combat Achievement tracker is far better than the PRD expected.** The
  catalogue is real data rather than 646 hand-typed rows, which is the
  difference between the feature existing and not.
- **Honest failure is a feature.** A tool that says how much it knows is
  trustworthy at the edges; one that returns silence is not trusted anywhere.

### Bad

- **This is not a clue solver.** 29 catalogued steps against a corpus in the low
  thousands is a demonstration of a mechanism, not a replacement for the Wiki.
  Anyone doing a hard or elite trail will still have the Wiki open. Calling this
  "the clue solver" in a changelog would oversell it.
- **The derivable types are only as good as an 86-name list**, which is heavily
  weighted to Misthalin, Asgarnia and the early game — the regions the author
  could verify. A master-tier cipher will usually miss.
- **Cryptic, emote, map, coordinate and puzzle clues have no path to coverage
  except authoring.** The largest and most-used part of the corpus is exactly
  the part this decision does not solve; it defers it honestly instead of
  pretending otherwise.
- **The name index will drift** as the game renames and removes NPCs, and
  nothing detects that. The wiki links mitigate it for a reader but not for us.
- **Self-declared CA progress is lost on a cleared cache**, and export/import
  puts the backup burden on the member. That is a direct cost of ADR-0012 and
  cannot be fixed without reintroducing accounts.

### Neutral

- **`CLAUDE.md`, `HANDOFF.md` and PRD §3.4 need corrections this branch must not
  make** (Phase B agents do not edit shared files): the `combat_achievement`
  bucket exists; drop-table buckets exist, so V9b is answerable; and the list of
  known buckets is 47, not 4.
- The `combat_achievement` bucket name is declared locally in
  `src/lib/clues/combat-achievements.ts` rather than added to `BUCKETS` in
  `wiki-bucket.ts`, to avoid a merge collision with sibling branches. Promoting
  it is a tidy-up.
- Adding steps is a reviewable, low-risk PR shape: append to one array, run
  `npm run check`, and the integrity test proofreads the anagrams.

## Alternatives considered

| Alternative                                                               | Why not chosen                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vendor an openly-licensed clue dataset** (the PRD's own suggestion)     | ADR-0007 forbids copying third-party source, and no candidate's licence has been checked. Doing it properly means reading a licence, recording the review, and carrying attribution — a decision for a human, not something to slip into a feature branch. Flagged, not done. |
| **Author the full corpus**                                                | Thousands of steps written from memory would be substantially wrong, and wrong game data is invisible to the person it misleads. Volume here is a liability, not a feature.                                                                                                   |
| **Ship the search UI over an empty dataset, with a "coming soon" banner** | A mechanism with no data is a demo. The derivable solvers give real answers on day one, which is the difference between a partial feature and a stub.                                                                                                                         |
| **Scrape the Wiki's Treasure Trails pages at build time**                 | The data lives in prose and templates, not a bucket, so it needs an HTML parser that breaks on every page edit. It also sends far more traffic than the "bulk over per-item, cache aggressively" rule in `docs/api-terms.md` contemplates, for a fragile result.              |
| **Drop the clue solver and ship only the CA tracker**                     | The mechanism is the reusable part, and the derivable solvers are genuinely useful now. Shipping the frame makes future data contributions cheap; not shipping it means they never start.                                                                                     |
| **Hand-author the 646 Combat Achievements** (PRD §3.4 option (a))         | Obsoleted by the bucket probe. Would have been days of typing for data one request returns.                                                                                                                                                                                   |
| **Build the collection log against TempleOSRS anyway**                    | Their terms are unread because their docs 403. `docs/api-terms.md` §6.7 makes unread terms a stop, and working around a deliberate block would be wrong twice over.                                                                                                           |

## Revisit if

- Someone checks the licence of an openly-licensed clue dataset and records the
  review — then bulk-importing it becomes the obvious move and this ADR's rule 4
  is what should change.
- The name index passes a few hundred entries, at which point seeding it from
  `Bucket:Infobox npc` (`npc_name`, `location` — verified to exist) beats hand
  maintenance.
- The Wiki adds a clue or Treasure Trails bucket, which would make the whole
  authoring question moot.
- **V2 is answered** and TempleOSRS's terms permit read-only cached use — the
  collection log page then becomes a feature instead of an explanation.
- Members report being sent to a wrong location, which would mean the "omit
  `location` rather than guess" rule is not being followed.
