# ADR-0005: Officer approval for RSN↔Discord linking

- **Status:** Accepted
- **Date:** 2026-07-24
- **Deciders:** PRD §5.3

## Context

Leaderboards, events and progress tracking are only trustworthy if an RSN
provably belongs to the Discord account claiming it. Without verification, any
member can claim any account and corrupt every ranking.

Three methods were assessed.

**Display-name challenge** (suggested in the original brief): have the user
temporarily rename their account to a token we issue. This does not survive
contact with the game — OSRS display name changes are slow, rate-limited and
cost real money. Asking members to rename their account to sign in is hostile
and for many is simply impossible.

**XP-delta challenge:** snapshot the RSN's XP, ask the user to gain a specified
small amount in a named skill within a window, confirm via the hiscores delta.
Genuinely proves account control using only public data, and is self-serve.
**But** hiscores update latency is unverified and believed to be periodic rather
than instant. If updates lag by hours, the flow collapses.

**Officer approval:** an officer confirms identity in-game and approves in-app.

## Decision

**We will use officer manual approval for the MVP.** The XP-delta challenge is
recorded as a Phase 2 self-serve upgrade, **gated on verifying hiscores update
latency** (PRD §9.1/V4).

Cardinality:

- **One RSN → at most one Discord account** (unique constraint). Without this,
  two members claim the same account and leaderboards break.
- **One Discord account → many RSNs**, deliberately: mains plus ironmen and alts
  are normal, and forbidding it would push members to lie. Exactly one link is
  `is_primary`, and leaderboards read only that, so alts cannot occupy several
  slots.

Competing claims are resolved in the officer UI: approving one auto-rejects the
others with a reason (status `superseded`), rather than letting the second
approval fail on a constraint violation.

## Consequences

### Good

- Deterministic. No dependency on unverified third-party behaviour.
- Adds no new human process — the clan already vets identity at recruitment;
  this relocates an existing step rather than inventing one.
- Negligible cost at this scale: roughly one approval per new member.
- Officer judgement handles edge cases (name changes, returning members) that no
  automated check would.

### Bad

- **Not self-serve.** Onboarding is blocked until an officer acts, which is a
  real friction point during recruitment pushes.
- Depends on officers staying responsive; a quiet week means a stuck queue.
- Trusts officers, and is only as good as their diligence — mitigated by
  audit-logging every approval.
- Does not scale past a few hundred members, though neither does the clan.

### Neutral

- The approval queue is a P0 deliverable, not an afterthought: the member-facing
  submit form is only half the feature.

## Alternatives considered

| Alternative                      | Why not chosen                                                                                                                                                                                                       |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Display-name challenge**       | Rejected as impractical: renames are slow, rate-limited and cost money. A case where the brief's suggestion doesn't survive the game's actual mechanics.                                                             |
| **XP-delta challenge (now)**     | Elegant and self-serve, but rests on hiscores update latency, which is exactly the fact we could not confirm. Choosing the verifiable-today option is the right trade when a wrong guess blocks onboarding entirely. |
| **Trust on first claim**         | Zero friction, zero verification. Makes every leaderboard meaningless.                                                                                                                                               |
| **RuneLite plugin verification** | Strongest proof, but requires members to install a plugin — an adoption barrier the PRD explicitly assumes we cannot clear (§9.3).                                                                                   |

## Revisit if

- **V4 resolves favourably** (hiscores update within minutes) → ship the
  XP-delta challenge as self-serve, keeping officer approval as the fallback.
- The approval queue becomes a recurring onboarding complaint.
