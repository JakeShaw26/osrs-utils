# ADR-0011: Operate as a compliant, non-commercial consumer of third-party APIs

- **Status:** Accepted
- **Date:** 2026-07-24
- **Deciders:** Repository owner
- **Resolves:** PRD V1

## Context

Every data source this project depends on belongs to someone else, and none of
them owe us access.

**V1** was flagged as the highest-priority legal check: is programmatic hiscores
access permitted? Having reviewed Jagex's published terms, the honest answer is
that **the question has no published answer**:

- Jagex's T&C **§15** says _"Jagex does not recommend, endorse or authorise the
  use of such Third-Party Software"_ and reserves the right to restrict access
  at any time.
- **§6** forbids commercially exploiting the Jagex Product.
- **§7** retains all IP in game data.
- There is **no document** explicitly permitting or forbidding programmatic
  hiscores access. The endpoint is public and unauthenticated, and large sites
  (Wise Old Man, TempleOSRS) have operated on it openly for years.

So there is no permission to obtain — only tolerance to avoid losing. Waiting
for clarity that does not exist would block the project indefinitely; the
realistic response is to behave in a way that keeps us comfortably inside what
is evidently tolerated, and to be honest in the docs that this is what we are
doing.

## Decision

**We will operate as a well-behaved, non-commercial, read-only consumer of
public data, and record each provider's terms and our resulting obligations in
[`docs/api-terms.md`](../api-terms.md).**

Binding commitments:

1. **Non-commercial, permanently.** No ads, no paid tiers, no selling data or
   access. Required independently by Jagex §6 and the wiki's CC-NC clause.
2. **Read-only, public data only.** Only data a member has voluntarily linked.
   Never authenticate as a player; never touch account data.
3. **Identify honestly** — descriptive User-Agent with contact info on every
   outbound request. Never spoof a browser or game client.
4. **Self-limit.** Assume undocumented limits are low. Cache aggressively; never
   fan out across members in a request path; require login for endpoints that
   proxy upstream, so limits key to a user rather than an open proxy.
5. **No gameplay automation, ever.** We are a website. We never interact with
   the game client and never assist botting. This is the clearest line and the
   one we stay furthest behind.
6. **Attribute everyone** whose data we display, with a Jagex non-affiliation
   disclaimer.
7. **Degrade, don't break.** Any provider may block us tomorrow. Losing a source
   must produce stale or absent data, not an error page.
8. **Never proceed on unread terms** — mark `[UNVERIFIED]` and check first.
   TempleOSRS (V2) is currently in this state.

`docs/api-terms.md` is **agent-facing context**: its rules are hard constraints
on a level with "don't commit secrets", and a task appearing to require breaking
one should be flagged rather than done.

## Consequences

### Good

- Keeps us inside evidently-tolerated behaviour, which is the actual goal — the
  risk was never a lawsuit, it was a quiet IP block that breaks the app for the
  whole clan.
- Documented rules survive contributor turnover and cold-start AI sessions,
  which is precisely where "be respectful of the API" otherwise gets lost.
- Graceful degradation makes us resilient to a block as well as an outage.

### Bad

- **Commits the project to being non-commercial forever.** Deliberate, and
  consistent with a clan tool, but it does close a door. Recovering commercial
  optionality would mean replacing both Jagex-derived and wiki-derived data —
  effectively a different product.
- Self-limiting costs freshness: shared caches over live per-user requests.
- Some features stay unbuildable on principle rather than on capability
  (anything needing bulk scraping or account-level data).

### Neutral

- Requires periodic review; terms change. Cadence: before each phase.

## Alternatives considered

| Alternative                                     | Why not chosen                                                                                                                                                                                                                           |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Seek explicit written permission from Jagex** | Ideal, and costs nothing to attempt. Rejected as a _blocker_: fan sites do not get bespoke API agreements, a non-answer is the likely outcome, and blocking on it stalls the project. Worth doing in parallel if the clan grows visible. |
| **Proceed without documenting any of it**       | The default, and how projects drift into abuse — usually not maliciously but because nobody wrote down why the cache TTL mattered.                                                                                                       |
| **Avoid Jagex data entirely, use only WOM**     | WOM is itself built on Jagex hiscores, so this launders the dependency rather than removing it.                                                                                                                                          |

## Revisit if

- Jagex publishes an API policy or takes action against similar sites.
- The project is ever considered for commercialisation → this ADR must be
  reversed first, and it likely cannot be.
- A provider's terms change (check before each phase).
