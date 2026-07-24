# Prompt: Generate a PRD for an OSRS Clan Toolkit

> Paste this into Claude Opus (Claude Code recommended, so subagent tooling and file-based ADR/doc output work naturally).

---

## Your task

You are writing a **Product Requirements Document (PRD)** for a web application called the **OSRS Clan Toolkit** — a single hub that brings together a wide range of Old School RuneScape utility tools, tailored for use by a specific clan, with Discord-based sign-in and role gating.

This is a planning task, not a build task. Do not write application code. Your deliverable is the PRD itself, plus supporting documentation as described below. Where you are uncertain, investigate rather than assume — this document will be handed to engineers (human and AI) who will build directly from it.

## Product scope

Full clan suite. The PRD must cover all of the following feature groups, each treated as its own section with its own feasibility research:

**Economy / Grand Exchange**

- Live GE price lookup + historical price graphs
- Flipping calculator (margin, GE tax, ROI)
- High alch profit calculator
- Skilling profit-per-hour calculators (herblore, crafting, smithing, etc.)

**Combat**

- DPS / max hit calculator (gear + prayers + boosts vs monster stats)
- Gear/loadout comparison tool
- Boss guide hub (mechanics, drop tables, drop rate calculators)
- Slayer task helper (block/skip value, extension advice)

**Skilling**

- XP calculator (current → target level/XP)
- Training method comparator (gp/xp, xp/hr across methods)
- Herb/farm run timer with reminders
- Construction cost calculator
- Agility course comparator

**Clues & Collection**

- Clue scroll solver (maps, ciphers, cryptic lookup)
- Collection log tracker/progress viewer
- Combat achievement tracker

**Account tools**

- Hiscores lookup (skills, minigames, bosses)
- Player progress tracking over time (requires our own snapshotting)
- Account value estimator
- Time-to-goal calculator

**Quests**

- Quest guide index with a "what can I do right now" requirements checker
- Quest point / unlock tracker
- Achievement diary requirement checker

**Utility**

- Interactive map with teleports / POH portal planner
- Prayer flicking timer
- Minigame point calculators (e.g. Barbarian Assault)
- Wilderness death-risk calculator
- Daily/weekly reset tracker

**Clan layer (applies across the above)**

- Leaderboards (XP gained daily/weekly/monthly, boss KC races, clue completions, GP from flipping)
- Clan-wide collection log / CA / diary completion %
- Group PvM tools (loot split calculators, gear comparisons between members)
- Clan events (bingo boards, skiller/PvM competitions with auto-tracked scoreboards)
- Shared flipping log
- Activity tracking (XP deltas over time)
- Rank-gated views (e.g. recruitment/applicant tools visible only to Officer+)

**Auth (MVP, not deferred)**

- Discord OAuth2 sign-in
- Clan Discord server membership verification
- Discord role → in-app permission mapping (e.g. Officer sees recruitment tools, Member sees standard dashboard, Applicant sees limited view)
- RSN-to-Discord-account linking, with a proposed verification method (e.g. temporary display name challenge, or officer manual approval) — pick one and justify it

## Required process: per-feature API investigation

For **every individual tool/feature** listed above, the PRD must include a short investigation block with:

1. **Candidate data sources** — e.g. OSRS Wiki Real-time Prices API, official Hiscores API (lite and full), OSRS Wiki API (quests/items/monsters), community-run APIs, or "no public API — must be derived/computed/scraped."
2. **Constraints per candidate** — rate limits, auth requirements, data freshness, historical data availability (note: official Hiscores has no history — anything needing history requires our own snapshot storage), licensing/ToS concerns, reliability/maintenance risk of third-party APIs.
3. **Decision** — the specific source chosen for that feature, with a one-to-two sentence justification tied to the constraints above.
4. **Flag unknowns** — if you cannot confirm an API's current existence, rate limits, or terms of use from your own knowledge, say so explicitly rather than guessing, and mark it for verification (web search or manual check) rather than presenting an assumption as fact.

Group features that share a data source (e.g. most combat/skilling calculators likely derive from the same OSRS Wiki data dumps) so the PRD doesn't repeat identical research per feature — but still document the shared decision once, clearly.

## Backend & architecture decisions

Investigate and recommend (do not just assume) an approach for:

- **Whether a backend is needed at all**, and for which features specifically (e.g. anything requiring hiscores snapshotting, Discord OAuth token handling, or write access clearly needs one; pure calculators may not).
- **Backend architecture** if one is needed — serverless functions vs a dedicated persistent service — with reasoning tied to: snapshot/cron jobs for hiscores tracking, Discord OAuth callback handling, database needs, and expected traffic scale (single clan, not internet-scale).
- **Data storage** — what needs persisting (player snapshots, RSN↔Discord links, clan config, bingo/event state, flipping logs) and what does not (anything derivable live from public APIs on request).
- **Scheduled jobs** — how periodic hiscores snapshotting will run given the chosen hosting model.

## Frontend architecture

- Next.js frontend.
- Components must follow **atomic design** (atoms → molecules → organisms → templates → pages). The PRD should define the folder structure convention for this and give 2-3 concrete examples of how specific features map to this hierarchy (e.g. "GE price input field" = atom, "flipping calculator form" = organism, "flipping calculator page" = template+page).
- Note any Next.js-specific decisions that affect this (App Router vs Pages Router, server components vs client components — flag where interactivity requirements push a component to be client-side).

## Skills investigation

Investigate whether **Claude Skills** should be introduced into this project (e.g. a skill encapsulating "how to query OSRS Wiki APIs correctly," "how to snapshot and diff hiscores data," or "how to generate an ADR for this project"). For each candidate skill:

- What repeated task it would encode
- Why a skill is a better fit than just documentation or a reusable code module
- Where it would live in the repo

If you conclude skills aren't a good fit yet (e.g. too early, not enough repeated patterns), say so and explain when it would become worth revisiting.

## Documentation & ADRs (ongoing, not just at the end)

The PRD must specify a documentation process to be followed **throughout the build**, not just delivered once at the end:

- **Architecture Decision Records (ADRs)** — one per significant decision (data source choice per feature group, backend architecture, auth/session model, database choice, etc.), using a standard ADR template (Context / Decision / Consequences / Alternatives considered).
- **Living project documentation** — structured so it can be fed back into Claude's context during the build (e.g. a `/docs` directory with a clear index, plus a root-level context file summarizing current architecture state, open questions, and decisions made, kept up to date as work progresses).
- Specify **when** ADRs get written (at time of decision, not retroactively) and **who/what** is responsible for keeping the living docs in sync as the PRD gets executed.

## Review process: adversarial + holistic pass via Fable subagent

Once you have produced a full draft PRD, hand it off to a **Fable subagent** for review, structured as two distinct passes:

1. **Holistic review** — does the PRD hang together as a coherent product? Are there gaps between sections (e.g. a feature that assumes a data source not covered in the API investigation, or a clan-layer feature that assumes an auth capability not specified)? Is scope realistic and internally consistent?
2. **Adversarial review** — actively try to break the plan. Look for: features whose chosen API is unlikely to actually support the described use case at the claimed rate limits; auth/security gaps in the Discord verification flow; storage or scaling assumptions that don't hold up; places where "investigate" was skipped in favor of assumption.

After the Fable subagent's review, revise the PRD to address its findings, and include a short **"Review Findings & Resolutions"** appendix documenting what was flagged and how it was addressed (or explicitly why it wasn't).

## Output format

Structure the final PRD as a markdown document with these sections, in order:

1. Overview & goals
2. Feature catalog (grouped as above), each with: description, per-feature API investigation, decision
3. Auth & clan verification design
4. Backend & architecture decision (with alternatives considered)
5. Frontend architecture (atomic design conventions)
6. Data model overview (what's persisted vs derived live)
7. Skills investigation & recommendation
8. Documentation/ADR process for the build phase
9. Open questions / risks / assumptions requiring human verification
10. Review Findings & Resolutions (post-Fable-review appendix)

Do not pad sections with generic filler — every claim about an API's capability or a technical constraint should be something you've actually reasoned through or flagged as needing verification, not asserted confidently from memory alone where recency or specifics matter.
