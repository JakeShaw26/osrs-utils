---
name: write-adr
description: Write an Architecture Decision Record for this project. Use when making any significant technical decision — data source, architecture, auth model, database, licensing, or reversing a previous ADR — so the record is created at decision time rather than retroactively.
---

# Write an ADR

## When

Write one **at the time of the decision, in the same PR that implements it.**

Retroactive ADRs record rationalisation, not reasoning. The alternatives you
genuinely weighed are forgotten within days — and they are the most valuable
part of the record.

Warrants an ADR:

- Choosing a data source for a feature group
- Architecture (hosting, backend shape, scheduling)
- Auth or session model changes
- Database or ORM choice
- Licensing decisions
- **Reversing an earlier ADR** — supersede it, never edit history

Does not warrant one: library picks with no lock-in, formatting, naming.

## Steps

1. **Find the next number:** `ls docs/adr/` and take the highest + 1.
2. **Copy the template:** `docs/adr/0000-template.md` →
   `docs/adr/NNNN-kebab-case-title.md`.
3. **Fill it in** (guidance below).
4. **Add a row to the table in `docs/README.md`** — same commit. An ADR missing
   from the index is an ADR nobody finds.
5. **Update `CLAUDE.md`** if the decision changes architecture, adds a data
   source, or resolves an open question.

## Writing each section

**Context** — the forcing constraints, not a narrative. Include measured facts
and link evidence (`docs/api-notes/`, a PRD section, a command you ran). If a
claim is unverified, **say so here** — a decision resting on an unconfirmed
capability is an unverified decision.

**Decision** — active voice: "We will …". Specific enough that a reviewer can
tell whether an implementation complies.

**Consequences** — split Good / Bad / Neutral. **The Bad section is mandatory
and must be real.** An ADR with no downsides is not a decision, it is an advert;
if you cannot name a cost, you have not understood the trade-off. Call out
anything **irreversible** explicitly (e.g. not snapshotting price history means
the past is unrecoverable).

**Alternatives considered** — a table. Include the option that was _genuinely
close_, and say what would make it win. This is the section future readers
actually need.

**Revisit if** — concrete triggers ("clan exceeds 2000 members", "WOM changes
its ToS"), not vague aspiration.

## Status

`Proposed` when it needs a human decision (cost, legal). `Accepted` once
settled. `Superseded by ADR-NNNN` when reversed — never delete or rewrite.

**An AI agent making an architectural decision must write the ADR as part of the
same change.** If the decision belongs to the human — money or legal exposure —
mark it `Proposed — needs human decision` and say what input is required.
