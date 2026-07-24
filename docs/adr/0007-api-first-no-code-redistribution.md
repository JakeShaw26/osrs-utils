# ADR-0007: API-first — consume APIs, do not redistribute third-party code

- **Status:** Accepted
- **Date:** 2026-07-24
- **Deciders:** Repository owner
- **Supersedes:** the earlier proposal to license this repository GPL-3.0

## Context

The earlier draft proposed reusing `weirdgloop/osrs-dps-calc` — the official
OSRS Wiki DPS calculator, GPL-3.0 — and licensing our own repository GPL-3.0 to
comply.

The reason that mattered: GPL's copyleft is often assumed not to apply to web
apps. That is true for **server-side** code (running GPL software on a server is
not distribution — that is what AGPL exists to close), but **false for
client-side JavaScript**. Shipping GPL-derived JS to a browser _is_ conveying,
which would oblige us to GPL our frontend and offer source.

The owner has decided: **do not distribute third-party code at all.** Consume
APIs instead, using the official wiki APIs where possible and other established
community APIs (Wise Old Man, and others) where not.

This is the better policy. It sidesteps the licensing question rather than
managing it, and it matches what we were already doing for every other feature.

## Decision

**We will obtain functionality by calling APIs, not by copying or vendoring
third-party source code.**

1. **Prefer official OSRS Wiki APIs** — Real-time Prices, Bucket.
2. **Where the wiki has no endpoint, use established community APIs** — Wise Old
   Man for tracking and competitions, TempleOSRS for collection log (pending
   V2). A mix of well-maintained sources is expected and fine.
3. **Do not copy, vendor, or port GPL-licensed source** into this repository.
4. **Where no API exists**, implement from **published documentation and
   public game formulas**, never from another project's source.

Compliance obligations for each API are recorded in
[`docs/api-terms.md`](../api-terms.md).

## ⚠️ The one place this policy does not reach: DPS

**There is no DPS-calculation API.** Verified: the official calculator at
`tools.runescape.wiki/osrs-dps/` is a **client-side application** — it computes
in the browser and exposes no endpoint. `api.weirdgloop.org` serves _data_, not
computation.

So for DPS and max hit specifically, "call an API instead" is not available. The
options reduce to:

- **Implement the formulas ourselves from public documentation** (the wiki's
  combat-formula pages, Bitterkoekje's published spreadsheet maths), using
  Bucket for monster stats. Legally clean — **formulas and game mechanics are
  facts, not copyrightable expression** — provided we do not copy their code.
- Drop the feature.

**Decision: implement from published formulas.** This is the "reimplement from
prose" option the earlier ADR listed as legally cleanest, now chosen on its
merits rather than as a fallback.

**This is real work and carries real risk.** Combat maths is dense with special
cases (Void, slayer helm, salve, Dharok's, elemental weakness, `flat_armour`),
and wrong output looks plausible rather than throwing an error.

**Mitigation — mandatory:** the DPS engine ships with a **golden-file test
suite**, comparing our output against values obtained by using the official
calculator as an end user for a fixed set of loadout/monster combinations.
Recording numbers produced by a public tool is not copying its code; the
expected values are facts about the game. If our numbers drift from the
community-accepted reference, tests fail.

## Consequences

### Good

- **No copyleft obligation.** This repository's licence is now a free choice.
- No vendored third-party code to keep in sync, audit, or re-license.
- Commercial options stay open from a _code_ standpoint — though Jagex §6 and
  the wiki's CC-NC still foreclose monetisation independently
  ([`api-terms.md`](../api-terms.md)).
- Aligns with what we already do everywhere else; one policy, no exceptions.

### Bad

- **DPS becomes a genuine build item rather than a reuse.** This is the largest
  single correctness risk in the catalog, and we now own it. Expect the golden
  tests to cost as much as the implementation.
- Every API is a runtime dependency: outages, rate limits and breaking changes
  become our problem (mitigated by caching and graceful degradation).
- More network round-trips than bundled computation.

### Neutral

- Repository licence still to be chosen — MIT or similar is now available.

## Alternatives considered

| Alternative                                           | Why not chosen                                                                                                                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Vendor the GPL calculator, GPL our repo**           | Maximum correctness for least effort, and honest. Rejected by the owner: it imposes copyleft on the whole codebase to obtain one feature.                                            |
| **Run GPL code server-side only, behind our own API** | Avoids client-side conveying, so no copyleft propagates. Still means operating a GPL-derived service and re-syncing upstream — and the owner's policy is no third-party code at all. |
| **Skip DPS entirely**                                 | Removes the largest correctness risk. Rejected: it is among the most-wanted tools in the catalog.                                                                                    |

## Revisit if

- Someone publishes a maintained DPS **API** → prefer it over our own engine.
- Our golden tests reveal drift we cannot close → reconsider server-side reuse.
