# OSRS Clan Toolkit — Product Requirements Document

**Status:** Draft v1.1 (post-review)
**Date:** 2026-07-24
**Owner:** Jake Shaw

> **On evidence in this document.** Every API claim below is tagged:
>
> - **[VERIFIED]** — I called the live endpoint on 2026-07-24 and observed the stated behaviour. Raw evidence in §11.
> - **[DOCUMENTED]** — stated in the provider's own docs, not independently exercised.
> - **[UNVERIFIED]** — could not confirm; **must be checked by a human before it is designed against**. Listed in §9.
>
> Nothing here is asserted from memory alone. Where I could not confirm something, it says so.

---

## 1. Overview & Goals

### 1.1 What this is

A single web hub collecting Old School RuneScape utility tools, scoped to one clan, gated behind Discord sign-in with clan-role-aware permissions. It replaces the current situation where members bounce between the Wiki, a DPS calculator, a flipping spreadsheet, Wise Old Man, and a pinned Discord message of bingo scores.

### 1.2 Goals

| #   | Goal                                                    | Success measure                                                            |
| --- | ------------------------------------------------------- | -------------------------------------------------------------------------- |
| G1  | One destination for the calculators members already use | Members stop linking external calculators in Discord for covered use cases |
| G2  | Clan-social layer that no external tool provides        | Leaderboards/events used in ≥1 clan event per month                        |
| G3  | Identity that is actually trustworthy                   | Every ranked member has a verified RSN↔Discord link                        |
| G4  | Cheap to run and maintain by one developer              | Hosting ≤ £35/mo (see §1.6); no scheduled job requires babysitting         |

### 1.6 Hosting cost — deferred by decision

An earlier draft claimed "< £20/mo" while specifying an **hourly** cron job. Those are
incompatible: **[UNVERIFIED — V13]** free hosting tiers typically restrict cron to roughly
**once per day**, so sub-daily scheduling implies a paid tier (~£16/mo).

**The owner has deferred the hosting decision until the app is functionally complete**
(ADR-0006). This is a sound deferral — hosting is a deployment concern, not an architectural
one, and the real job shape will be known by then.

**What this requires of the build, now:**

- Scheduled work lives behind ordinary HTTP routes protected by `CRON_SECRET`, **never inside
  a platform-specific cron primitive.** Any trigger (platform cron, GitHub Actions, a VPS
  crontab) can then invoke them.
- Jobs are **chunked, resumable and idempotent** regardless of host (§4.5).
- **Nothing may assume a persistent process exists.** With no Discord bot (ADR-0010), the
  architecture has no always-on component — do not reintroduce one casually.

G4's cost target is provisional until V13 is settled. Note the WOM API key may change the
arithmetic entirely: 500 members at 20 req/min is ~25 minutes, but at 100 req/min it is ~5.

### 1.3 Explicit non-goals

- Not a public/internet-scale tool. Traffic is one clan (assume **≤500 members, ≤50 DAU, ≤5 concurrent**). This assumption justifies most architecture choices below; if the product is later opened publicly, §4 must be revisited.
- Not a RuneLite plugin. Browser only.
- Not competing with Wise Old Man on tracking — we **consume** it (§2.4).
- No real-money trading, botting assistance, or ToS-violating automation.

### 1.4 The single most important scoping decision

The feature list as given is roughly 35 tools. Built naively that is a multi-year solo project. The PRD's core strategic move is **buy/borrow over build**:

- Historical tracking, competitions, and group gains → **delegate to Wise Old Man** (MIT, actively maintained) rather than building a snapshot pipeline.
- Combat maths → **port from the official Wiki DPS calculator's formulas** rather than deriving them (with a licensing caveat, §2.3).
- Static game data → **OSRS Wiki Bucket API**, the Wiki's own maintained query layer.

This collapses the genuinely novel build surface to: auth/identity, the clan-social layer, and thin calculator UIs.

### 1.5 Phasing

Phasing is driven by dependency, not by feature popularity. Auth is P0 because the clan layer is meaningless without trustworthy identity, and retrofitting authorisation onto existing routes is where security bugs come from.

| Phase                       | Contents                                                                                                                                                                | Rationale                                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **P0 — Foundation**         | Discord OAuth, guild+role gating, **RSN link submission _and_ the officer approval queue** (§5.3 — both halves, they are one feature), app shell, `/docs` + ADR process | Everything else depends on identity                                                                               |
| **P1 — Economy**            | GE lookup + graphs, flipping calc, high alch, item search, **hiscores lookup**                                                                                          | Single data source, highest daily use. Hiscores lookup needs only the proxy, not WOM                              |
| **P2 — Static calculators** | XP calc, combat/DPS, gear compare, skilling & construction calcs, agility, quests, diaries, **account value estimator**, **farm-run timer UI (no reminders — see P3)**  | All share the Bucket/static-data pipeline                                                                         |
| **P3 — Clan layer**         | Leaderboards, competitions, bingo, clan collection log, activity tracking, **progress tracking**, **time-to-goal**, **Web Push reminder delivery**                      | Depends on P0 identity + WOM integration. Push delivery lands here, so anything needing notification waits for it |
| **P4 — Long tail**          | Clue solver, map/POH planner, boss hub, minigame calcs, wilderness risk, prayer flick timer                                                                             | High content-authoring cost, low technical risk                                                                   |

**Phasing rule:** every feature in §3 appears in exactly one phase above. A feature whose
delivery mechanism lands in a later phase (the farm-run timer's reminders) is **split across
phases explicitly** rather than shipped half-working — P2 delivers a working in-page timer,
P3 adds push delivery.

---

## 2. Data Sources — Shared Investigation

Per the brief, sources are investigated **once** here and referenced by ID from the feature catalog (§3), rather than repeating identical research per feature.

### 2.1 DS-1 — OSRS Wiki Real-time Prices API

**Base:** `https://prices.runescape.wiki/api/v1/osrs`

**[VERIFIED]** All endpoints called successfully on 2026-07-24.

| Endpoint      | Returns                                    | Verified detail                                                                                                                           |
| ------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `/latest`     | `{itemId: {high, highTime, low, lowTime}}` | Works bulk and with `?id=`. Instant-buy/instant-sell prices with Unix timestamps                                                          |
| `/mapping`    | Static item metadata                       | **849,840 bytes**, one array. Includes `id`, `name`, `examine`, `members`, `lowalch`, `highalch`, `limit` (GE buy limit), `value`, `icon` |
| `/5m`, `/1h`  | Averaged high/low + volume traded          | Optional `timestamp` for a specific block                                                                                                 |
| `/timeseries` | Price history for one item                 | Requires `id` + `timestep` ∈ {`5m`,`1h`,`6h`,`24h`}                                                                                       |

**[VERIFIED] — Critical constraint on history depth.** `/timeseries` returns a hard maximum of **365 data points**, so the timestep dictates the window:

| timestep | points | span          |
| -------- | ------ | ------------- |
| `5m`     | 365    | **2.3 days**  |
| `1h`     | 365    | **15.3 days** |
| `6h`     | 365    | **91.3 days** |
| `24h`    | 365    | **364 days**  |

**This means ~1 year is the ceiling on price history, and fine granularity is only available very recently.** A "2-year price chart" is not buildable from this API. See ADR-0003 for how we handle it.

**Rate limits [DOCUMENTED]:** The Wiki states it does _not_ explicitly rate-limit, caches at multiple levels, and reserves the right to block usage that threatens stability ("multiple large queries per second, sustained"). **We must not design as though this is a guarantee** — it is goodwill, and abusing it gets the whole clan's IP blocked.

**User-Agent is mandatory [DOCUMENTED].** The Wiki pre-emptively blocks default agents (`python-requests`, `curl`, `Java`, `Apache-HttpClient`, `RestSharp`). We must send a descriptive UA with contact info, e.g.
`osrs-clan-toolkit/1.0 (+https://<domain>; discord: <handle>)`.
This is a hard build requirement, centralised in one fetch wrapper — see §7.1, this is the single strongest argument for a Claude Skill.

**Licensing:** Wiki content is CC BY-NC-SA 4.0. **[UNVERIFIED]** whether the NC (non-commercial) clause applies to API data. Our use is non-commercial, so this is fine as-is, but it **forecloses monetisation** — flagged in §9.

---

### 2.2 DS-2 — OSRS Wiki Bucket API (static game data)

**Base:** `https://oldschool.runescape.wiki/api.php?action=bucket`

**[VERIFIED]** Live and queryable on 2026-07-24. This is the Wiki's own semantic data layer; it **replaces the deprecated Semantic MediaWiki `action=ask`** system.

Query syntax is a chained expression passed as a `query` param:

```
bucket('infobox_item')
  .select('item_name','item_id','high_alchemy_value','buy_limit')
  .where('item_name','Rune platebody')
  .limit(1).run()
```

**[VERIFIED]** returned:

```json
{
  "bucket": [
    {
      "item_id": ["1127"],
      "high_alchemy_value": 39000,
      "buy_limit": 70,
      "item_name": "Rune platebody"
    }
  ]
}
```

**[VERIFIED] `infobox_item` fields:** `item_name`, `image`, `is_members_only`, `item_id`, `examine`, `high_alchemy_value`, `league_region`, `release_date`, `removal_date`, `value`, `weight`, `version_anchor`, `buy_limit`, `default_version`, `quest`, `tradeable`.

**[VERIFIED] `infobox_monster` fields (55):** including `hitpoints`, `max_hit`, `combat_level`, `attack_level`, `strength_level`, `defence_level`, `ranged_level`, `magic_level`, all five defence bonuses, `stab/slash/crush/magic/range_attack_bonus`, `attack_speed`, `attack_style`, `slayer_level`, `slayer_category`, `slayer_experience`, `flat_armour`, `elemental_weakness`, `elemental_weakness_percent`, `freeze_resistance`, `venom_immune`, `cannon_immune`.

That field list is sufficient to drive a DPS calculator without any third-party monster database.

**Gotchas discovered while testing:**

- Field names are **not** guessable. `highalch`, `high_alch`, and `monster_name` all failed; the real names are `high_alchemy_value` and (for monsters) `name`. **Always introspect the schema first** via
  `action=parse&page=Bucket:Infobox monster&prop=wikitext`.
- `item_id` is `repeated` (returns an array) because of item variants. Consumers must handle arrays, not scalars.
- Multi-version pages (e.g. Zulrah's forms) use `version_anchor` / `default_version` — naive queries return duplicate rows.

**Rate limits [UNVERIFIED].** The Bucket doc page does not state limits. Standard MediaWiki etiquette applies. Because this data is near-static, we sidestep the question entirely by building at build-time (§4.4).

---

### 2.3 DS-3 — Combat formulas (implemented in-house)

**[VERIFIED]** `weirdgloop/osrs-dps-calc` is the **official OSRS Wiki DPS calculator**, actively
maintained (last commit 2026-07-23), and **GPL-3.0 licensed**.

**Decision (ADR-0007): we consume APIs and copy no third-party code.** GPL-3.0 is strong
copyleft, and while it is often assumed not to bite a web app, that is only true for
server-side code — shipping GPL-derived JavaScript to a browser _is_ conveying, and would
oblige us to GPL our frontend. Rather than manage that, we avoid it.

> **⚠️ [VERIFIED] There is no DPS-calculation API — this is the one place the API-first policy
> cannot reach.** The official calculator at `tools.runescape.wiki/osrs-dps/` is a
> **client-side application**; it computes in the browser and exposes no endpoint.
> `api.weirdgloop.org` serves data, not computation.
>
> So DPS and max hit must be **implemented by us from published formulas** — the wiki's
> combat-formula pages and Bitterkoekje's published maths — with monster stats from Bucket
> (DS-2). Game mechanics are facts, not copyrightable expression, so implementing documented
> formulas is clean provided no code is copied.
>
> **This is real work and the largest correctness risk in the catalog**: combat maths is dense
> with special cases, and wrong output looks plausible rather than erroring. **Mandatory
> mitigation:** golden-file tests pinned to values obtained by using the official calculator as
> an end user, so drift from the community-accepted reference fails the build. Recording
> numbers a public tool produces is not copying it.

Every other feature in this PRD is genuinely API-backed; DPS is the sole exception.

---

### 2.4 DS-4 — Official Hiscores

**Endpoint:** `https://secure.runescape.com/m=hiscore_oldschool/index_lite.json?player=<rsn>`

**[VERIFIED]** Returns `{name, skills[], activities[]}`. 24 skills; **90 activities**.

**[VERIFIED] — Two decisive constraints:**

1. **[VERIFIED] No CORS headers.** I inspected the response headers directly: there is **no `Access-Control-Allow-Origin`**. Browsers will block every direct call. **A server-side proxy is not an optimisation — it is mandatory.** This single fact independently forces a backend (§4.1).
2. **[VERIFIED for this endpoint; [UNVERIFIED] as a general claim] No history.** What I actually observed is that `index_lite.json` returns a point-in-time snapshot with no historical parameter. I did **not** establish that no Jagex hiscores endpoint anywhere exposes history — a single positive test cannot prove the absence of a capability. Treat it as: _no known public Jagex endpoint provides history._ The design consequence is unchanged either way (someone must store snapshots), and WOM already does, so this does not block anything — but the claim is narrower than v1.0 stated.

**[VERIFIED] — Coverage gaps that kill two features as specified:**

| Data                    | In hiscores?                                                                  |
| ----------------------- | ----------------------------------------------------------------------------- |
| Skills (level/xp/rank)  | ✅ all 24                                                                     |
| Boss KC                 | ✅                                                                            |
| Clue scrolls            | ✅ all tiers (`all`, `beginner`, `easy`, `medium`, `hard`, `elite`, `master`) |
| **Combat Achievements** | ❌ **absent**                                                                 |
| **Achievement Diaries** | ❌ **absent**                                                                 |
| Collection log          | ❌ absent                                                                     |

I enumerated all 90 activity names and filtered for clue/achievement/diary/combat terms; only the seven clue entries matched. **The CA tracker and diary tracker have no public data source** and cannot be auto-populated. Handled in §3.4/§3.6.

**Rate limits [UNVERIFIED].** Jagex publishes no documented limit. Community wrappers self-impose ~100/min. **We must assume a low limit and treat 429/403 as expected**, not exceptional.

**ToS [UNVERIFIED].** I could not locate a Jagex document that explicitly permits or forbids programmatic hiscores access. Given large public sites (Wise Old Man, TempleOSRS) operate openly and durably, tolerance is evidently high — but _tolerated_ is not _licensed_. Flagged in §9 as the highest-priority legal check.

---

### 2.5 DS-5 — Wise Old Man API

**Base:** `https://api.wiseoldman.net/v2` · Docs: `docs.wiseoldman.net`

**[VERIFIED] License MIT. Last commit 2026-07-24 — actively maintained** (same day as writing).

**[DOCUMENTED] Rate limit: 20 requests / 60 seconds, raised to 100/60s with a free API key.**

WOM already implements, as a maintained product, the majority of our clan layer: player tracking and snapshotting, gains/deltas over arbitrary periods, groups, competitions with auto-tracked scoreboards, leaderboards, and record-keeping.

**This is the most consequential decision in the PRD (ADR-0002): we consume WOM rather than building our own snapshot pipeline.** Rationale:

- It removes the need for us to poll Jagex at all for tracking, which sidesteps the unverified Jagex rate limit and ToS risk (§2.4) by putting a well-established intermediary between us and Jagex.
- Building our own snapshotting for 500 members means a cron job, a time-series schema, backfill handling, name-change handling, and dead-account pruning. WOM has solved all of these, including the genuinely fiddly one (**name changes**).
- MIT license means no copyleft friction, and self-hosting is a viable escape hatch if WOM disappears.

**Risk:** a third-party dependency for a core feature group. Mitigation in §9/R2 — we store our own thin daily snapshot of the handful of metrics our leaderboards use, so a WOM outage degrades rather than destroys the clan layer.

**[UNVERIFIED]** WOM's ToS regarding a third-party app driving group updates on a schedule. Must be confirmed with WOM (they have a public Discord) before P3.

---

### 2.6 DS-6 — TempleOSRS

**Base:** `https://templeosrs.com/api/`

The only identified public source for **collection log** data, plus group collection endpoints.

**[UNVERIFIED] — and I want to be blunt about how weakly this one is evidenced.** `templeosrs.com/api_doc.php` returned **HTTP 403** to my fetch, so I could not read the official documentation. Everything I have is second-hand from search results and third-party repos (`sequenter/Cloggers`, `voltmaister/collection-tracker`). Specifically unconfirmed: exact endpoint shapes, rate limits, whether an API key is needed, and group endpoint semantics.

**Structural constraint (high confidence, from how the product works):** TempleOSRS collection log data is **opt-in and player-sourced** — it exists only for players who install the RuneLite plugin and sync. It is therefore **not a complete dataset**, and coverage of our clan will be partial and unevenly fresh.

**Design consequence:** any clan collection log view must be built to render _partial_ data honestly — showing "synced 3 days ago" / "not synced" per member rather than implying an authoritative clan-wide percentage. A completion percentage computed over partially-synced members is actively misleading. This shapes the UI, so it is a requirement, not a caveat.

---

### 2.7 DS-7 — Discord API

OAuth2 for identity; guild membership and roles for authorisation. Scopes:

| Scope                 | Purpose                                                                      |
| --------------------- | ---------------------------------------------------------------------------- |
| `identify`            | Discord user ID, username, avatar                                            |
| `guilds`              | Confirm the user is in the clan guild                                        |
| `guilds.members.read` | **Read the user's roles within our guild** — this is what powers rank gating |

**[DOCUMENTED]** `guilds.members.read` returns the full guild member object including the `roles` array. Both `guilds` and `guilds.members.read` are needed for role-based gating.

**[DOCUMENTED]** Discord's global REST limit is ~50 req/s per bot, with per-route buckets and `X-RateLimit-*` headers. Far beyond our needs.

---

### 2.8 DS-8 — Derived / no external source

Features with **no public API**, where the "data source" is content we author or maths we implement: clue scroll solutions, POH/teleport planning, prayer-flick timing, wilderness risk rules, reset schedules, minigame point formulas, and quest requirement graphs. These are **content-authoring costs, not integration costs** — low technical risk, high time cost. Deliberately concentrated in P4.

### 2.9 DS-9 — Rejected: osrsbox-db

Commonly recommended in search results and older forum posts as _the_ OSRS item/monster database, and its README states it is "updated after every weekly game update."

**[VERIFIED] — that claim is false. Last commit 2021-09-30; last push 2022-08-07.** The project is ~5 years stale and GPL-3.0.

**Rejected.** Adopting it would mean shipping a database missing roughly five years of items, bosses, and gear — every recent raid, weapon, and monster would be silently absent, and the failure mode is _wrong answers_, not errors. DS-2 (Bucket) supersedes it with officially-maintained data.

> This is the clearest example in this document of why the brief demanded verification over recall: the popular answer, the README, and the search-result summary all agreed with each other and were all wrong. Any agent building from memory would have chosen it.

---

## 3. Feature Catalog

Each feature lists its data source ID, a decision, and any feature-specific constraint. Where a group shares a source, the shared rationale is stated once.

### 3.1 Economy / Grand Exchange — _primary source: DS-1_

**Shared decision:** All economy tools derive from the OSRS Wiki Real-time Prices API. It is the only public source of live GE prices, is purpose-built for this, and `/mapping` supplies alch values and buy limits, so no second source is needed.

| Feature                     | Source                               | Decision & constraints                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Live GE price lookup**    | DS-1 `/latest` + `/mapping`          | Cache `/mapping` (850KB) at build time or in a long-lived server cache — it changes only on game updates. Fetch `/latest` in bulk once and serve all lookups from it rather than per-item calls; this is both faster and the polite pattern the Wiki asks for.                                                                                                                                                                                                                                                                              |
| **Historical price graphs** | DS-1 `/timeseries`                   | **Constrained by [VERIFIED] 365-point cap.** Offer exactly four ranges mapping to the four timesteps (2d / 15d / 90d / 1y). **Do not offer "all time" or multi-year** — the data does not exist. If longer history is later required, we must snapshot daily ourselves from launch; that is a product decision to make now, because history cannot be backfilled.                                                                                                                                                                           |
| **Flipping calculator**     | DS-1 `/latest`, `/5m`                | Margin = `low` (your buy) → `high` (your sell). **GE tax [UNVERIFIED at current rates]: 2% on sales above 50gp, capped per item, with an exempt-item list.** Tax rules have changed more than once and the cap was raised; the rate and cap **must be re-confirmed against the Wiki at implementation time** and encoded in one constants module, never inlined. Use `/5m` volume to warn on illiquid items — a fat margin on an item trading 3/day is a trap, and showing margin without volume is the most common flaw in flipping tools. |
| **High alch profit**        | DS-1 `/latest` + `/mapping.highalch` | Profit = `highalch − buy price − nature rune price`. All inputs from one source. Must respect `limit` (buy limit) to show realistic hourly profit.                                                                                                                                                                                                                                                                                                                                                                                          |
| **Skilling profit/hr**      | DS-1 + DS-8                          | Prices from DS-1; **inputs/outputs/rates per method are hand-authored content** (DS-8). This is the real cost — a herblore recipe table, actions/hr assumptions, etc. Store as versioned JSON in-repo, not in the DB, so changes are reviewable in PRs.                                                                                                                                                                                                                                                                                     |

### 3.2 Combat — _primary sources: DS-2 (data) + DS-3 (formulas)_

**Shared decision:** Monster stats from Bucket `infobox_monster` ([VERIFIED] to expose every stat a DPS calc needs); formulas from the official Wiki calculator, subject to the GPL decision in §2.3.

| Feature                      | Source      | Decision & constraints                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **DPS / max hit calculator** | DS-2 + DS-3 | Highest-complexity feature in the product. Combat maths has many special cases (Void, slayer helm, salve, Dharok's, elemental weakness, `flat_armour`). **Implemented in-house from published formulas** (ADR-0007) — no DPS API exists and no GPL code is copied. Work from the wiki's documented combat maths, never from another project's source. **Golden-file tests are mandatory**, pinned to values from the official calculator: this is the one feature where "looks about right" is indistinguishable from wrong. Budget as much time for the tests as the implementation. |
| **Gear/loadout comparison**  | DS-2 + DS-3 | Same engine, N loadouts against one monster. Equipment bonuses come from Bucket's equipment data. **[UNVERIFIED]** whether a dedicated equipment-stats bucket exists separate from `infobox_item`; introspect before building.                                                                                                                                                                                                                                                                                                                                                        |
| **Boss guide hub**           | DS-2 + DS-8 | Stats and drop tables from Bucket; **mechanics/strategy prose must be authored or linked**. Recommend linking out to the Wiki for strategy rather than duplicating — we cannot keep prose current, and stale boss strategy is worse than no strategy. Drop-rate calculator is pure maths (binomial), no source needed.                                                                                                                                                                                                                                                                |
| **Slayer task helper**       | DS-2 + DS-8 | `slayer_category`, `slayer_level`, `slayer_experience` from Bucket. **Task weightings per Slayer master are not in Bucket** — hand-authored (DS-8). Block/skip value needs the member's own preferences, so this is one of the few calculators that benefits from being logged in.                                                                                                                                                                                                                                                                                                    |

### 3.3 Skilling — _primary sources: DS-4 (player state) + DS-8 (rates)_

| Feature                          | Source        | Decision & constraints                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **XP calculator**                | DS-8 + DS-4   | XP table is a fixed 99-entry constant — no API. Optionally prefill "current XP" from hiscores via our proxy when a member has a linked RSN. Works fully logged-out.                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Training method comparator**   | DS-1 + DS-8   | gp/xp needs live prices (DS-1); xp/hr rates are **authored estimates** and inherently contentious. Show them as editable assumptions rather than facts, and cite their origin — otherwise every disagreement about rates becomes a bug report.                                                                                                                                                                                                                                                                                                                                                                      |
| **Herb/farm run timer**          | DS-8 + own DB | Pure client timing; persist per-user timers server-side so they survive device changes. **Browser notifications require an explicit permission prompt and are unreliable when the tab is closed.** True reminders need a service worker + **Web Push**. A Discord DM would have far better delivery, but **ADR-0010 rules out a bot**, and webhooks can post to a channel yet cannot DM a user. **Decision: Web Push**, accepting weaker delivery (permission prompt; unreliable on iOS unless installed to the home screen) as the cost of having no always-on service. Timer UI ships in P2; push delivery in P3. |
| **Construction cost calculator** | DS-1 + DS-8   | Material lists per item authored; prices live. Straightforward.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Agility course comparator**    | DS-8          | Course xp/hr and mark rates authored. No API.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

### 3.4 Clues & Collection

| Feature                        | Source              | Decision & constraints                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------ | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Clue scroll solver**         | DS-8 (+DS-2 images) | No API for clue solutions. This is **the largest content-authoring task in the product** (thousands of steps across cryptic/map/anagram/ciphers). Ship as a searchable dataset in-repo. Scope P4, and consider seeding from an existing openly-licensed dataset with attribution — building from scratch is likely weeks of data entry.                                                                              |
| **Collection log tracker**     | DS-6                | **Only viable source is TempleOSRS, and it is [UNVERIFIED] (§2.6).** Data is opt-in/plugin-sourced and therefore incomplete. **Requirement:** display per-member sync freshness and explicitly mark unsynced members; never present a clan-wide % that silently treats unsynced members as 0%.                                                                                                                       |
| **Combat achievement tracker** | ❌ **none**         | **[VERIFIED] not in hiscores.** No confirmed public API. Options: (a) manual self-report by members, (b) TempleOSRS _if_ it exposes CA data **[UNVERIFIED]**, (c) drop the feature. **Recommend (a) manual entry for MVP**, since CA tiers change rarely and self-report is cheap — but this must be presented as member-reported, not verified, and must not feed competitive leaderboards where it could be gamed. |

### 3.5 Account tools

| Feature                         | Source             | Decision & constraints                                                                                                                                                                                                                                                                                  |
| ------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hiscores lookup**             | DS-4 via our proxy | **Must be server-proxied — [VERIFIED] no CORS.** Cache per RSN ~5 min to shield Jagex from repeat lookups. Handle "player not on hiscores" (404/empty) as a normal state, not an error.                                                                                                                 |
| **Progress tracking over time** | DS-5 (WOM)         | Delegated to WOM (ADR-0002). WOM already stores history; we render it. Avoids building a snapshot pipeline.                                                                                                                                                                                             |
| **Account value estimator**     | DS-1 + DS-6        | **Fundamentally limited: there is no API that exposes a player's bank or worn gear.** Best achievable is a _manual_ inventory the member enters, valued live via DS-1. **Must be labelled an estimate of declared items, not net worth** — otherwise it will be read as authoritative and it cannot be. |
| **Time-to-goal calculator**     | DS-5 + DS-8        | Current XP from hiscores; recent xp/hr from WOM gains gives a personalised rather than generic ETA — a genuine advantage of the WOM decision.                                                                                                                                                           |

### 3.6 Quests

| Feature                               | Source      | Decision & constraints                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Quest index + "what can I do now"** | DS-2 + DS-8 | Requires a **quest requirements graph** (skill levels, QP, prerequisite quests) — a dependency DAG. **[UNVERIFIED]** whether a `Bucket:Infobox quest` exists with structured requirements; **introspect before assuming**. If absent, author the graph manually. Given a member's hiscores levels, solve for completable quests. Genuinely useful and not well served elsewhere. |
| **QP / unlock tracker**               | ⚠️ partial  | **Quest completion is not in the hiscores.** QP cannot be read automatically. Requires manual entry or plugin sync. Design the requirements checker to work from _levels_ (which we do have) and treat quest completion as user-declared.                                                                                                                                        |
| **Diary requirement checker**         | DS-8 + ⚠️   | **[VERIFIED] diaries are not in hiscores.** Requirements are authored; _completion_ is self-reported. Same pattern as quests: check what's _achievable_ from levels; don't claim to know what's _done_.                                                                                                                                                                          |

### 3.7 Utility — _all DS-8_

| Feature                              | Decision & constraints                                                                                                                                                                                                             |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Interactive map / POH planner**    | The Wiki runs a Leaflet-based map with published tiles. **[UNVERIFIED]** tile usage terms — must confirm before embedding; hotlinking someone's tile server without permission is not acceptable. Highest-effort utility item; P4. |
| **Prayer flicking timer**            | Pure client-side tick timer (0.6s). No data source. Small, self-contained — a good first contribution.                                                                                                                             |
| **Minigame point calculators**       | Authored formulas per minigame. Independent, incrementally shippable.                                                                                                                                                              |
| **Wilderness death-risk calculator** | Authored rules (items kept on death, protect-item, skull) + DS-1 prices. Rules are subtle and change; version them.                                                                                                                |
| **Daily/weekly reset tracker**       | Pure date maths against known reset times. Must handle UTC vs local and BST correctly — a classic source of off-by-one-hour bugs. No API.                                                                                          |

### 3.8 Clan layer — _DS-5 + own DB + DS-7_

**Shared decision:** competitive/tracking features delegate to WOM; clan-specific state we own.

| Feature                                | Source        | Decision & constraints                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Leaderboards (XP/KC/clues)**         | DS-5          | WOM group gains endpoints supply daily/weekly/monthly deltas directly. **Do not compute from raw hiscores.** Cache aggressively (§4.3) — a leaderboard page must never fan out to N per-member requests, which at 500 members and 20 req/min would take 25 minutes.                                                                                                                                                                                                                                         |
| **GP-from-flipping leaderboard**       | own DB        | **Self-reported and therefore trivially falsifiable.** There is no way to verify GE trades externally. Either accept it as honour-system and label it so, or omit it from competitive contexts. Recommend: keep as a personal log, exclude from ranked leaderboards.                                                                                                                                                                                                                                        |
| **Clan collection log / CA / diary %** | DS-6 + own DB | **Resolved (v1.0 contradicted itself here — §3.4 forbade CAs in competitive contexts while this row left it open).** Decision: show collection log % (TempleOSRS-sourced, with per-member sync freshness) as a **non-competitive informational view only**. CA and diary figures are member-declared and are **excluded from any ranked or composite score**. No blended "clan completion %" that mixes verified and self-reported data — it would be unverifiable, gameable, and misleading in one number. |
| **Group PvM tools**                    | DS-1 + own DB | Loot split maths is arithmetic; gear comparison reuses §3.2 with multiple members' declared loadouts.                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Clan events (bingo, competitions)**  | DS-5 + own DB | Board definitions, tiles, and teams are ours; auto-scoring reads WOM gains. **Bingo tiles that depend on drops rather than XP/KC cannot be auto-verified** and need officer confirmation with a screenshot — design the tile model to support both auto and manual verification from day one, because retrofitting manual approval into an auto-scored model is painful.                                                                                                                                    |
| **Shared flipping log**                | own DB        | Members log flips; aggregate views. Self-reported (see above).                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Activity tracking (XP deltas)**      | DS-5          | WOM gains.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Rank-gated views**                   | DS-7 + own DB | See §5.4. **Enforced server-side, always.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

---

## 4. Backend & Architecture

### 4.1 Is a backend needed? — Yes, unavoidably

This was investigated rather than assumed. Four independent forcing functions, any _one_ of which is sufficient:

1. **[VERIFIED] Hiscores sends no CORS headers.** Direct browser calls are blocked by the browser. A proxy is required.
2. **Discord OAuth2 requires a client secret** to exchange the authorisation code for a token. A secret in frontend code is not a secret. _(OWASP A02: Cryptographic Failures / A07: Auth Failures.)_
3. **Authorisation must be server-enforced.** Rank gating done in React is decoration — anyone can edit client state. If Officer-only recruitment data reaches the client, it has leaked. _(OWASP A01: Broken Access Control — the #1 risk, and the exact shape of this mistake.)_
4. **Write features need durable storage** (RSN links, bingo state, flipping logs).

**Note the split:** the pure calculators (XP, DPS, high alch, construction, prayer timer) genuinely need no backend and should be built to work logged-out. That is a deliberate resilience property — if auth or the DB is down, most of the site still works.

### 4.2 Recommended architecture

**Next.js (App Router) on Vercel, with Route Handlers as serverless functions, Vercel Cron for scheduling, and a managed serverless Postgres (Neon or Supabase).**

**Reasoning tied to the specific constraints:**

- **Traffic profile (≤50 DAU) makes a persistent server wasteful.** A 24/7 container costs money to idle. Serverless scales to zero and this workload is bursty and tiny.
- **The usual serverless objection — cold starts — is acceptable here.** A clan tool is not latency-critical at the p99.
- **The usual serverless objection that actually bites is execution time limits** (Vercel: 60s Hobby / 300s Pro). This matters for exactly one thing: bulk member refreshes. See §4.5.
- **One deployment unit.** Frontend and API ship together; a solo developer maintaining a separate backend service is a tax with no return at this scale.
- **Postgres over NoSQL** because the data is relational (members ↔ RSNs ↔ events ↔ scores) and the queries are aggregate/leaderboard-shaped, which is SQL's home turf.

> **⚠️ Serverless + Postgres pitfall — hard build requirement.** Every serverless invocation
> that opens its own Postgres connection will exhaust `max_connections` under even modest
> concurrency, because functions scale horizontally while the database does not. **All
> serverless routes must use the provider's _pooled_ connection string** (Neon's PgBouncer
> endpoint / Supabase's pooler), **not the direct one.** The direct connection is for
> migrations only. This belongs in the same category as the mandatory User-Agent and the
> `CRON_SECRET`: centralised in one module, never improvised per route. It is called out here
> because it fails only under load — never in local development, which is the worst possible
> time to discover it.

**Alternatives considered (full comparison in ADR-0001):**

| Option                                        | Why rejected                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Persistent Node service (Railway/Fly/VPS)** | Fewer runtime limits and easy long-running cron, but adds always-on cost, patching, and deployment surface for one developer. **Genuinely close** — it would be the choice if we ran our own snapshotting, or if the refresh job proves not to fit serverless limits (V10). With no bot (ADR-0010) there is no longer a standing reason to run one, but ADR-0006 keeps the option open. |
| **Static site, no backend**                   | Impossible. Defeated by CORS, OAuth secrets, and server-side authorisation (§4.1).                                                                                                                                                                                                                                                                                                      |
| **Separate SPA + standalone API**             | Two deploys, two repos, CORS config, no SSR benefit. Cost without benefit at this scale.                                                                                                                                                                                                                                                                                                |
| **Supabase-only (BaaS, no custom backend)**   | Handles DB/auth but not the Wiki/hiscores proxying or the UA requirement; still need server code, so it doesn't remove the backend, only splits it.                                                                                                                                                                                                                                     |

### 4.3 Caching strategy

Caching is a **first-class requirement**, not an optimisation — it is how we stay within the goodwill-based limits of DS-1 and the hard limits of DS-5.

| Data                    | TTL               | Where             | Why                                                        |
| ----------------------- | ----------------- | ----------------- | ---------------------------------------------------------- |
| Item mapping (DS-1)     | build-time / 24h  | Static or edge    | 850KB, changes only on game updates                        |
| Live prices (DS-1)      | 60s, **shared**   | Server cache      | One fetch serves all users. Never per-user, never per-item |
| Timeseries (DS-1)       | 5m–1h by timestep | Server cache      | Matches underlying granularity                             |
| Static game data (DS-2) | build-time        | Repo/ISR          | Near-static; removes Bucket from the request path entirely |
| Hiscores (DS-4)         | 5m per RSN        | Server cache      | Protects Jagex from repeat lookups                         |
| WOM group data (DS-5)   | 5–15m             | Server cache + DB | **Essential** — 20 req/min is a real ceiling               |

**Hard rule for implementers:** no user-facing request may trigger an uncached fan-out across clan members. Leaderboards read pre-aggregated rows, never live loops.

### 4.4 Data storage

**Persist (write path / no external source of truth):** Discord↔RSN links, member profiles and cached roles, clan config, event/bingo definitions and scores, flipping logs, manual declarations (quests, diaries, CAs), a thin daily leaderboard snapshot (WOM-outage insurance, §9/R2), **per-user farm-run timer state** (§3.3 requires timers to survive device changes), **member-declared item inventories** (§3.5 account value estimator), **the RSN link approval queue** (§5.3), **refresh-job cursor + `last_run_at`** (§4.5), and **the audit log** (§5.4).

> The last five were missing from v1.0's list while being required by features elsewhere in
> the document — the classic feature-to-schema gap. Any §3 feature with a write path must
> appear here.

**One shared table for member declarations.** CAs (§3.4), quest completion and diary
completion (§3.6) are three instances of one pattern: _member asserts an unverifiable fact
about their account._ Model them as a single `member_declarations` table
(`member_id, kind, key, value, declared_at`) with one shared UI organism, not three parallel
implementations. They share storage, trust level, and presentation ("member-reported").

**Do not persist (derivable live):** GE prices, item/monster stats, current hiscores, WOM history, computed calculator outputs. Caching ≠ storing; these have an authoritative upstream and duplicating them creates staleness bugs.

### 4.5 Scheduled jobs

Two recurring jobs, both via **Vercel Cron** hitting protected Route Handlers:

| Job            | Frequency | Purpose                                                     |
| -------------- | --------- | ----------------------------------------------------------- |
| Clan refresh   | hourly    | Ask WOM to update the group; cache leaderboard aggregates   |
| Daily snapshot | daily     | Thin metrics snapshot for outage resilience + event scoring |

> **⚠️ CI/serverless pitfall — the constraint most likely to be missed.** With 500 members and WOM's 20 req/min, a naive "refresh every member" loop takes **~25 minutes** and will blow the serverless execution limit (60s/300s). Mitigations, in order of preference: (1) use WOM's **group-level** update endpoints rather than per-member calls; (2) process in **chunks per cron tick** with a cursor in the DB, so each invocation is short and the work is resumable; (3) move to a persistent worker. **Never** design a single cron invocation that must finish all members.

> **⚠️ Mitigation (1) is itself [UNVERIFIED] — do not build on it until checked (§9.1/V10).**
> v1.0 asserted "use WOM's group-level update endpoints" without confirming such an endpoint
> exists, whether it costs one request or one-per-member internally, and whether it is
> synchronous or queued. That is the exact failure this PRD warns against elsewhere, so it is
> called out rather than quietly fixed. **If no cheap group-level update exists, mitigation (1)
> evaporates and the serverless-only design in §4.2 may not be executable at all.** With
> ADR-0010 removing the bot, there is **no always-on fallback host** — so the remaining
> options are chunked jobs (mitigation 2), a WOM API key cutting the pass from ~25 to ~5
> minutes, or reopening the hosting decision (ADR-0006). Verify before committing engineering
> time to the chunked-cursor design.

**Chunked-job requirements (if mitigation 2 is used).** The cursor design must be resumable
_and_ idempotent, because serverless invocations can be killed mid-flight:

- Advance the cursor **only after** a chunk's writes commit, in the same transaction.
- Make member refresh idempotent (upsert on `member_id + snapshot_date`), so a chunk replayed
  after a crash produces no duplicates.
- Record `last_run_at` and surface a staleness warning in the UI if the job has not completed
  a full pass in 48h. G4 says no job should need babysitting — that requires the job to
  _report_ when it is stuck, not merely to retry.

**Cold-start bootstrap (missed in v1.0).** Launch requires importing ~500 existing members
into a WOM group in one burst — a larger spike than steady-state refresh, against the same
20–100 req/min ceiling. **[UNVERIFIED]** whether WOM's group-create/edit endpoint accepts a
bulk player list in a single call. If it does, this is trivial; if not, it is a ~25-minute
throttled backfill that **must be run as a one-off script from a developer machine, not from
a serverless function.** Plan it as an explicit P3 launch task with a runbook entry.

> **⚠️ Cron endpoint security.** Vercel Cron routes are public HTTPS URLs. They **must** verify a `CRON_SECRET` (Vercel sends it as an `Authorization` header) or anyone can trigger our refresh loop and burn our rate-limit budget for us. Rejecting unauthenticated calls is mandatory, not defence-in-depth.

**No Discord bot (ADR-0010).** The owner has ruled one out, so the architecture has **no
always-on component at all**. Consequences:

- **Reminders** → Web Push via a service worker (§3.3), not DMs.
- **Event announcements** → a **Discord incoming webhook**: a URL any HTTP client can POST to,
  requiring no bot, no gateway connection and no persistent host. This preserves announcements
  at essentially zero cost.
- **Scheduling** → platform cron or an external trigger (GitHub Actions, cron-job.org) hitting
  a `CRON_SECRET`-protected route. **Never assume a long-running process is available.**

This also resolved **V11**: OAuth-only role gating does not require a bot in the guild
(ADR-0010), so P0 auth has no hidden dependency on a component we are not building.

---

## 5. Auth & Clan Verification

### 5.1 Flow

Standard OAuth2 Authorization Code flow with Discord, server-side:

1. User clicks "Sign in with Discord" → redirect with scopes `identify guilds guilds.members.read` and a **`state` parameter (CSRF protection — mandatory, not optional)**.
2. Discord redirects back with a code; the **server** exchanges it for a token using the client secret.
3. Server calls the guild member endpoint for our clan guild ID.
   - Not a member → rejected with a join link.
   - Member → read the `roles` array.
4. Map Discord role IDs → app permissions (§5.4).
5. Issue **our own session** (httpOnly, Secure, SameSite=Lax cookie). Store the Discord access token **server-side only**, never in a cookie readable by JS and never in localStorage.

**Recommendation: Auth.js (NextAuth) with the Discord provider**, extended to fetch guild roles in the callback. Hand-rolling OAuth is a well-known source of subtle security bugs; use the maintained library.

### 5.2 Session and role-freshness model

**Roles are a snapshot, and this is the subtle risk.** If we cache roles for the session lifetime, a demoted or kicked member keeps Officer access until it expires.

**Decision:** short session (24h) + **re-verify roles server-side on any access to Officer-gated data or any privileged mutation**, not merely at login. Read-only member views may use cached roles for up to 15 minutes. This bounds the damage window for a demotion to minutes on the routes that matter, rather than a day.

> **⚠️ Revalidation must fail CLOSED. This is the load-bearing detail of the whole section.**
>
> Revalidation means calling Discord's guild-member endpoint with the stored access token.
> That call can fail four ways: token expired, Discord is down, the user revoked our app's
> authorisation, or **the user was kicked from the guild (a 404, not a stale-role response)**.
>
> The intuitive implementation — "call failed, so keep the cached roles and carry on" — is the
> easy path and it **silently defeats this entire mechanism**. A kicked or demoted Officer
> would retain access indefinitely, which is precisely the vulnerability this section exists
> to close. An outage would become a privilege-escalation window.
>
> **Required behaviour:**
>
> - Any revalidation error on a privileged route → **deny the action and force re-authentication.** Never fall back to cache.
> - Distinguish `404 / not a member` (revoke session immediately, delete cached roles) from `5xx / transient` (deny _this_ privileged action, allow read-only member views to continue on cache within the 15-minute window).
> - Degrading to a lower privilege tier on error is acceptable; degrading to a _higher_ one never is.
>
> **Token lifecycle (unspecified in v1.0):** Discord access tokens expire. Store the **refresh
> token** server-side and rotate proactively; if refresh fails, end the session rather than
> holding a dead token. Encrypt both tokens at rest — the scopes are read-only, so this is
> defence-in-depth rather than critical, but the DB is not the right place for bearer
> credentials in plaintext.

### 5.3 RSN ↔ Discord linking — recommended method

The brief asks for one method, chosen and justified. Options assessed:

| Method                      | Assessment                                                                                                                                                                                                                                                                                                                                            |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Display-name challenge**  | Suggested in the brief, but **OSRS display name changes are slow, rate-limited, and cost real money.** Asking members to rename their account to prove ownership is hostile and, for many, impossible. **Rejected as impractical** — this is a case where the brief's suggestion doesn't survive contact with the game's mechanics.                   |
| **XP-delta challenge**      | Elegant: snapshot the RSN's XP, ask the user to gain a specified small amount in a named skill within a window, confirm via hiscores delta. Genuinely proves account control using only public data. **But** hiscores update latency is **[UNVERIFIED]** and believed to be periodic rather than instant — if updates lag by hours, the UX collapses. |
| **Officer manual approval** | Officer confirms in-game identity (members are already vetted at recruitment) and approves in-app. Deterministic, zero external dependencies.                                                                                                                                                                                                         |

**Decision: officer manual approval for MVP; XP-delta challenge as a Phase 2 self-serve upgrade, gated on verifying hiscores update latency.**

Justification: the clan already performs identity vetting at recruitment, so this adds no new human process — it relocates an existing one. It has **no dependency on unverified third-party behaviour**, which matters because the XP-delta approach's viability rests on exactly the fact I could not confirm. Volume is low (one approval per new member), so the manual cost is negligible at this scale. Choosing the verifiable-today option over the elegant-but-unverified one is the right trade when a wrong guess blocks onboarding entirely.

**Cardinality (unstated in v1.0, and it affects the schema):**

- **One RSN → at most one Discord account.** Enforced by a unique constraint. Without it, two members claim the same RSN and every leaderboard is corrupt.
- **One Discord account → many RSNs.** Deliberately allowed: mains plus ironmen and alts are normal in OSRS clans, and forbidding it would push members to lie. Each link is approved independently, and **exactly one is flagged `is_primary`** for leaderboard purposes so alts cannot be used to farm multiple leaderboard entries.

**Race condition on the approval queue:** two members may submit link requests for the same
RSN before an officer processes either. The unique constraint fires at _approval_ time, not
submission, so the officer UI must surface competing claims side by side rather than letting
the second approval fail with a database error. Approving one auto-rejects the others with a
reason.

**Anti-abuse regardless of method:** re-linking requires officer approval and is audit-logged.

### 5.4 Permission model

Map Discord role IDs to internal permissions via **configuration, not hardcoded IDs**:

| Tier                 | Sees                                                                  |
| -------------------- | --------------------------------------------------------------------- |
| **Guest** (no login) | Public calculators only                                               |
| **Applicant**        | Calculators + own profile; no clan data                               |
| **Member**           | Full calculators, leaderboards, events, own logs                      |
| **Officer**          | + recruitment tools, applicant review, event admin, RSN link approval |
| **Admin**            | + clan config, role mapping                                           |

**Implementation requirements (all OWASP A01):**

- Permission checks live in **one server-side module**; every protected Route Handler calls it.
- **Deny by default** — a new route with no explicit check must fail closed, not open.
- Officer-only data must **never be sent to the client and hidden with CSS**. Filter at the query layer.
- Privileged mutations are audit-logged (actor, action, target, timestamp). **The audit log is append-only, readable by Admin only, and never mutable through the application** — a log that officers can edit provides no accountability against the people it exists to hold accountable.

### 5.5 Additional security requirements

- **Rate-limit our own endpoints per user**, especially hiscores lookup — otherwise we are an open proxy that lets anyone use us to hammer Jagex from our IP, which gets _us_ blocked.
  > **⚠️ "Per user" is meaningless for anonymous traffic — v1.0 had a hole here.** §5.4 grants
  > Guests access to public tools, and hiscores lookup was not explicitly gated, so there is no
  > user identity to key a limit on. **Decision: hiscores lookup requires login.** It is a
  > clan tool, the RSN autocomplete is more useful for members anyway, and gating it gives us a
  > stable identity to rate-limit. Public calculators stay open because they make **no outbound
  > requests** — that is the actual dividing line: _anything that proxies an upstream API
  > requires auth; anything that is pure client-side maths does not._
  > Apply IP-based limiting at the edge as a second layer for the login route itself.
- Validate/allowlist all user input server-side, particularly RSNs (12 chars, `[A-Za-z0-9 _-]`) before interpolating into upstream URLs. _(SSRF/injection — never pass raw user input into an outbound URL.)_
- Secrets via environment variables only; never `NEXT_PUBLIC_*`. **`NEXT_PUBLIC_` prefixed vars are inlined into the client bundle** — putting the Discord client secret there would publish it to every visitor.
- CSRF protection on state-changing routes.

---

## 6. Frontend Architecture

### 6.1 Next.js decisions

- **App Router** — current default, better layout nesting, and React Server Components let us keep API keys and heavy data-fetching server-side by construction.
- **Server Components by default; Client Components only where interactivity demands.** This is the main architectural discipline, because it directly determines what leaks to the browser.
- **TypeScript strict mode**, with generated types for all external API shapes.

**Where interactivity forces client-side (flag these explicitly):**

| Must be client                  | Why                              |
| ------------------------------- | -------------------------------- |
| Calculator forms                | Real-time recalculation on input |
| Price charts                    | Charting libs need DOM/canvas    |
| Timers (farm run, prayer flick) | `setInterval`, live ticking      |
| Gear-loadout builder            | Complex local state              |

| Should stay server                       | Why                                                   |
| ---------------------------------------- | ----------------------------------------------------- |
| Page shells, layouts, nav                | No interactivity                                      |
| Initial price/hiscores/leaderboard fetch | **Keeps UA header, caching, and secrets server-side** |
| Permission-gated data fetching           | Server is the only place authorisation is trustworthy |

**Pattern:** server component fetches and authorises → passes plain data as props → thin client component handles interaction. Push the `"use client"` boundary **as far down the tree as possible**; a `"use client"` at the page level drags the whole subtree into the bundle and forfeits the benefit.

### 6.2 Atomic design convention

```
src/components/
├── atoms/        # indivisible; no business logic; no data fetching
├── molecules/    # small groups of atoms; one job
├── organisms/    # feature-complete sections; may own local state
├── templates/    # layout/composition; no data fetching
└── ui/           # shadcn/ui or similar primitives, kept separate
src/app/          # Next.js routes = "pages"; data fetching + auth live here
```

**Rules that keep the hierarchy from rotting:**

- Atoms/molecules **never** fetch data or import domain logic.
- Data fetching happens in `app/` (server components) and flows **downward as props**.
- Domain logic lives in `src/lib/`, never in components — so calculators are unit-testable without rendering.
- A component may only import from its own layer or below. Enforce with an ESLint boundary rule; conventions that aren't linted are aspirations.

**Concrete mappings (as required by the brief):**

**1. Flipping calculator**

| Layer    | Component                                                                                                               |
| -------- | ----------------------------------------------------------------------------------------------------------------------- |
| Atom     | `ItemSearchInput`, `GpAmount` (formats `1.4b`), `MarginBadge`                                                           |
| Molecule | `ItemPicker` (input + autocomplete list), `PriceStat` (label + value + timestamp)                                       |
| Organism | `FlippingCalculatorForm` — owns inputs, calls `lib/economy/flipping.ts`, renders results. **`"use client"`**            |
| Template | `CalculatorLayout` — title, description, tool slot, notes slot                                                          |
| Page     | `app/tools/flipping/page.tsx` — **server component**, fetches item mapping + prices, renders template with the organism |

**2. GE price graph**

| Layer    | Component                                                                  |
| -------- | -------------------------------------------------------------------------- |
| Atom     | `TimeRangeButton`, `ChartTooltip`                                          |
| Molecule | `TimeRangeSelector` (the four verified ranges — §3.1)                      |
| Organism | `PriceHistoryChart` — **`"use client"`**, owns selected range              |
| Page     | `app/items/[id]/page.tsx` — server-fetches initial series, passes as props |

**3. Clan leaderboard**

| Layer    | Component                                                                                                               |
| -------- | ----------------------------------------------------------------------------------------------------------------------- |
| Atom     | `RankNumber`, `PlayerAvatar`, `XpDelta`                                                                                 |
| Molecule | `LeaderboardRow`, `MetricSelector`                                                                                      |
| Organism | `ClanLeaderboard` — server component; **pure presentation over pre-aggregated data**                                    |
| Page     | `app/clan/leaderboard/page.tsx` — **authorises first**, then reads cached aggregates (never fans out per member — §4.3) |

---

## 7. Claude Skills Investigation

**Conclusion: yes, but only two — and specifically not the one the brief suggested.**

The test applied: a Skill earns its place when it encodes _procedural knowledge applied while writing code_, which a library cannot enforce and documentation will not be read at the right moment. If the knowledge is "what to do," a module is better. If it's "how to decide," a Skill is better.

### 7.1 Recommended: `osrs-data-sources` — **strong case**

**Encodes:** which source to use per data type; the mandatory User-Agent (DS-1); Bucket's non-guessable field names and the introspect-first rule; the 365-point timeseries ceiling; **that osrsbox-db is stale and must never be used**; the no-fan-out caching rule.

**Why a Skill beats docs or a module:** a module enforces _mechanics_ but cannot stop an agent from picking the wrong source in the first place. This project has a documented trap — the popular, well-reviewed, README-endorsed answer (osrsbox-db) is five years dead (§2.9). Any agent working from training data will reach for it, and the failure is silent wrong data. A Skill injects that correction at the moment of decision, which is the only moment it helps. Same for the UA header: forgetting it doesn't fail loudly in dev, it gets us blocked later.

**Lives in:** `.claude/skills/osrs-data-sources/SKILL.md`

### 7.2 Recommended: `write-adr` — **moderate case**

**Encodes:** the ADR template, next-number allocation, and the index-update step.

**Why a Skill:** the brief mandates ADRs _at time of decision_, across a long build. The failure mode is silent omission, and the fiddly parts (numbering, index sync) are exactly what gets skipped under time pressure. A Skill makes "write the ADR" a single invocable action.

**Lives in:** `.claude/skills/write-adr/SKILL.md`

### 7.3 Rejected: "snapshot and diff hiscores data"

Suggested in the brief; **rejected on two grounds.** First, after ADR-0002 we delegate snapshotting to WOM, so the repeated task largely ceases to exist. Second, even if it existed it is deterministic behaviour with fixed inputs and outputs — that is the textbook definition of **a well-tested module**, not a Skill. Encoding it as a Skill would mean re-deriving logic that should be written once and imported. Skills should encode judgement; functions should encode computation.

### 7.4 Revisit trigger

Reassess if: we take on our own snapshotting (WOM dependency fails), calculator scaffolding becomes repetitive enough to template, or a second contributor joins and onboarding knowledge needs encoding.

---

## 8. Documentation & ADR Process

### 8.1 Structure

```
/PRD.md                      # this document
/CLAUDE.md                   # living context, loaded into every AI session
/docs/
  README.md                  # index
  adr/
    0000-template.md
    0001-....md
  api-notes/                 # verified API behaviour + gotchas
  data/                      # authored-content schemas
```

### 8.2 ADR rules

**Template:** Title · Status · Context · Decision · Consequences (good _and_ bad) · Alternatives considered.

**When:** at the time of decision, in the **same PR that implements it**. Retroactive ADRs record rationalisation, not reasoning — the alternatives that were genuinely weighed are forgotten within days, and those are the most valuable part of the record.

**What warrants one:** data source choices, architecture, auth/session model, DB choice, licensing decisions (§2.3), and any reversal of a previous ADR (supersede, never edit history).

**Who:** whoever makes the decision, human or AI. **An AI agent making an architectural choice must write the ADR as part of the same change** — this is enforced by `.claude/skills/write-adr` and stated in `CLAUDE.md`.

### 8.3 Living documentation

`CLAUDE.md` at the repo root is the **context file loaded into every AI session**. It must stay under ~200 lines to remain useful and contains: current architecture state, decisions made (with ADR links), open questions, active constraints (UA requirement, rate limits, no-fan-out rule), and current phase.

**Sync responsibility:** updating `CLAUDE.md` is part of the **definition of done** for any change altering architecture, adding a data source, or resolving an open question. A PR that changes architecture without updating it is incomplete. This is the mechanism that prevents the documentation drift that makes AI-assisted builds degrade over time — stale context actively misleads, which is worse than no context.

### 8.4 API notes

`/docs/api-notes/` records **empirically verified** behaviour — the Bucket field names, the 365-point cap, the missing CORS header — with the date verified and the command used. This exists because upstream docs were incomplete or wrong in several places during this research, and re-deriving these facts later is pure waste.

**Evidence tagging applies to proposed solutions, not just upstream claims.** The review of
v1.0 (§10/C2) found this document confidently asserting an API capability _inside a
mitigation_ while carefully tagging every other claim. A fix that depends on an unverified
capability is an unverified fix. Tag it accordingly.

---

## 9. Open Questions, Risks & Assumptions

### 9.1 Requires human verification before building the dependent feature

| #        | Item                                                                                                                                                                                                                                                                                                                                                                                                                                         | Blocks                                                 | Priority                          |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------- |
| V1       | **✅ RESOLVED — ADR-0011.** Jagex publishes no API policy. T&C §15 tolerates third-party software without endorsing it and reserves the right to restrict access; §6 forbids commercial exploitation; §7 retains all IP. There is no permission to obtain, only tolerance to keep. Stance: non-commercial, read-only, self-limiting, honestly identified. Rules in [`docs/api-terms.md`](docs/api-terms.md).                                 | Hiscores lookup, all tracking                          | **Highest** — legal               |
| V2       | **TempleOSRS API** — docs returned HTTP 403 to automated fetch. Endpoints, auth, limits all unconfirmed.                                                                                                                                                                                                                                                                                                                                     | Collection log (§3.4)                                  | High                              |
| V3       | **Current GE tax rate, cap, and exemptions.** Rules have changed more than once.                                                                                                                                                                                                                                                                                                                                                             | Flipping calculator                                    | High — wrong maths destroys trust |
| V4       | **Hiscores update latency.** Determines whether the XP-delta RSN challenge is viable.                                                                                                                                                                                                                                                                                                                                                        | RSN linking Phase 2                                    | Medium                            |
| V5       | **WOM ToS** on third-party scheduled group updates.                                                                                                                                                                                                                                                                                                                                                                                          | Clan layer                                             | Medium                            |
| V6       | **Wiki CC BY-NC-SA "NC" clause** applied to API data. Non-commercial use is safe; **forecloses monetisation**.                                                                                                                                                                                                                                                                                                                               | Any future commercial plan                             | Medium                            |
| V7       | **Wiki map tile usage terms.**                                                                                                                                                                                                                                                                                                                                                                                                               | Interactive map                                        | Low (P4)                          |
| V8       | **✅ RESOLVED — ADR-0007.** API-first; no third-party code copied. Since no DPS API exists, formulas are implemented in-house from published maths, with mandatory golden-file tests.                                                                                                                                                                                                                                                        | DPS calculator                                         | High before P2                    |
| V9       | **Bucket schemas for quests/equipment/drop tables** — introspect; do not assume they exist.                                                                                                                                                                                                                                                                                                                                                  | Quests, gear compare                                   | Medium                            |
| V10      | **WOM group-level update endpoint** — does it exist, does it cost one request or one-per-member, is it sync or queued? §4.5's primary mitigation for the cron-timeout problem depends entirely on this.                                                                                                                                                                                                                                      | P3 clan refresh; possibly the §4.2 serverless decision | **High**                          |
| V11      | **✅ RESOLVED — ADR-0010.** OAuth-only role gating does **not** require a bot: `/users/@me/guilds/{id}/member` is a user-token endpoint with no stated bot precondition, and `guilds.join` — which _does_ require it — says so explicitly. **Residual V11a:** a 10-minute empirical check before P0 auth — a circular dependency that would surface on day one of P0. Confirm the _preconditions_ for the call, not just its response shape. | **P0 auth — blocks the first sprint**                  | **High**                          |
| V12      | **WOM bulk group-create/import** — can ~500 players be added in one call, or is launch a 25-minute throttled backfill?                                                                                                                                                                                                                                                                                                                       | P3 launch runbook                                      | Medium                            |
| V13      | **Free-tier cron frequency limit** (§1.6) — confirm before choosing a hosting tier. **Deferred by decision (ADR-0006)**; get the WOM API key first, as it may cut the refresh pass from ~25 min to ~5 and change the answer.                                                                                                                                                                                                                 | Budget, refresh design                                 | Medium                            |
| **V11a** | **10-minute empirical check, do this first:** create a throwaway Discord app, do NOT add it to the guild, authorise with `identify guilds guilds.members.read`, and call `GET /users/@me/guilds/{guild.id}/member`. A 200 with a `roles` array confirms ADR-0010. Anything else reopens the entire auth model.                                                                                                                               | **P0 auth — blocks the first sprint**                  | **Highest**                       |

### 9.2 Key risks

| #   | Risk                                                                                                        | Mitigation                                                                                                                    |
| --- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| R1  | **Scope.** ~35 tools is far beyond a realistic solo build; the likeliest failure is 30 half-finished tools. | Strict phasing (§1.5). Ship P1 complete before starting P2. Treat the catalog as a backlog, not a commitment.                 |
| R2  | **WOM dependency** for the whole clan layer.                                                                | Own thin daily snapshot (§4.4) so an outage degrades to stale-but-present. MIT license permits self-hosting as a last resort. |
| R3  | **Getting IP-blocked by the Wiki or Jagex.** Goodwill-based limits, not contractual.                        | Mandatory UA, aggressive shared caching, per-user rate limits on our own proxy (§5.5), no-fan-out rule.                       |
| R4  | **Authored content rot** (xp/hr rates, clue solutions, drop tables) going silently stale.                   | Version authored data in-repo; show "last updated"; prefer linking the Wiki for volatile prose (§3.2).                        |
| R5  | **Self-reported data corrupting competition.** Flipping GP, CAs, diaries are unverifiable.                  | Label as member-reported; **exclude from ranked leaderboards** (§3.8).                                                        |
| R6  | **Combat formula errors** — silently wrong, high trust cost.                                                | Golden-file tests pinned to the official calculator (§3.2).                                                                   |

### 9.3 Assumptions

1. Clan ≤500 members, ≤50 DAU. **Most of §4 depends on this** — revisit if it changes by an order of magnitude.
2. The clan has one Discord server, and roles there are the authoritative rank source.
3. Non-commercial, no ads, no paid tiers (see V6).
4. One primary developer, AI-assisted.
5. Members will not install a RuneLite plugin _except_ the subset already using TempleOSRS — collection log coverage will be partial (§2.6).

---

## 10. Review Findings & Resolutions

Draft v1.0 was reviewed by a Fable subagent in two passes (holistic, then adversarial). It
returned **19 findings**: 3 Critical, 9 Major, 7 Minor. All were adopted; several were genuinely
load-bearing. The review's most useful property was catching places where _this document_
committed the sin it warns others about.

### Critical

| #   | Finding                                                                                                                                                                                                                                                                                                                                                                   | Resolution                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | **Role revalidation didn't specify fail-open vs fail-closed** (§5.2). The section exists to bound stale-role risk, but never said what happens when the Discord call _itself_ fails. The intuitive implementation (fall back to cached roles) silently defeats the entire mechanism — a kicked Officer keeps access, and an outage becomes a privilege-escalation window. | **Accepted — the most valuable finding in the review.** §5.2 now mandates fail-closed, distinguishes `404 not-a-member` (revoke session) from transient `5xx` (deny privileged action only), and states the general rule: degrading to a _lower_ tier on error is fine, to a _higher_ one never. Also added the token-refresh lifecycle, which v1.0 omitted entirely.                                                                                                                 |
| C2  | **§4.5's own mitigation rested on an unverified assumption.** The fix for the cron-timeout problem was "use WOM's group-level update endpoints" — asserted with no evidence and, unlike every other API claim, no verification tag.                                                                                                                                       | **Accepted, and it stings.** This is precisely the failure the brief asked me to hunt for, committed in the fix rather than the problem. Now tagged `[UNVERIFIED]`, added as **V10**, with the consequence stated plainly: if no cheap group endpoint exists, the serverless-only design may not be executable and the always-on bot host becomes the fallback. **Later superseded:** ADR-0010 removed the bot, so there is no always-on fallback — see §4.5 for the current options. |
| C3  | **Budget contradiction** (§1.2 vs §4.5): "< £20/mo" alongside an hourly cron, when Vercel's free tier caps cron at ~daily and the doc already reasoned in Pro-tier terms.                                                                                                                                                                                                 | **Accepted.** Added §1.6 with honest costs (~£25–35/mo on Pro). Recommended the cheaper path: daily cron on Hobby, with ad-hoc refreshes triggered from the always-on Discord bot — removing platform cron limits from the critical path. G4 revised to ≤£35/mo.                                                                                                                                                                                                                      |

### Major

| #   | Finding                                                                                                           | Resolution                                                                                                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | `guilds.members.read` may require bot presence in the guild → P0 auth would secretly depend on the P3 bot.        | Accepted. Added as **V11**, flagged as blocking the first sprint. The review was appropriately uncertain here; it's now a pre-P0 check rather than an assumption in either direction.    |
| M2  | Per-user rate limiting is meaningless for anonymous traffic, so the open-proxy risk (R3) was not actually closed. | Accepted. §5.5 now **requires login for hiscores lookup**, with the general rule: anything proxying an upstream API needs auth; pure client-side maths does not.                         |
| M3  | Farm-run timer sat in P2 but its reminders need the P3 bot.                                                       | Accepted. §1.5 splits it — timer UI in P2, push delivery in P3 — plus a general rule that features are split across phases rather than shipped half-working.                             |
| M4  | §3.5 Account tools had no phase in §1.5.                                                                          | Accepted. Hiscores lookup → P1; account value → P2; progress tracking and time-to-goal → P3 (WOM-dependent). Added the invariant that every §3 feature appears in exactly one phase.     |
| M5  | §4.4 omitted timer state and declared inventories that §3 requires persisting.                                    | Accepted. Added those plus the approval queue, job cursor, and audit log — five write paths the data model had missed.                                                                   |
| M6  | §3.4 forbade CAs in competitive contexts while §3.8 left a composite % open.                                      | Accepted. Resolved in favour of the stricter reading: no blended verified/self-reported percentage.                                                                                      |
| M7  | No cold-start plan for importing ~500 members into WOM.                                                           | Accepted. Added to §4.5 as an explicit launch task (**V12**), to be run as a one-off script, never from a serverless function.                                                           |
| M8  | No serverless↔Postgres connection-pooling guidance.                                                               | Accepted. Added as a hard build requirement in §4.2, noting it fails only under load — never locally.                                                                                    |
| M9  | `[VERIFIED]` overreach on "hiscores has no history" — one positive test cannot prove absence of a capability.     | **Accepted; correct on the epistemics.** Rescoped to "this endpoint returns a snapshot; no known public endpoint provides history." Design impact unchanged, claim now matches evidence. |

### Minor

All seven adopted: shared `member_declarations` table for the three self-report flows (§4.4);
RSN cardinality made explicit, allowing alts with one `is_primary` link (§5.3); officer
approval queue named as a P0 deliverable (§1.5); cron idempotency/resumability and staleness
alerting (§4.5); the approval-queue race condition (§5.3); token encryption at rest (§5.2);
audit log append-only and Admin-read-only (§5.4).

### Rejected

None. Every finding was either factually right or pointed at a real ambiguity.

### Reviewer notes

Two observations worth recording. First, the review's highest-value findings were **internal
inconsistencies**, not factual errors — the research was sound, but sections drifted apart as
the document grew, and cross-section contradictions are exactly what a single author stops
seeing. Second, C2 and M9 are both cases of the document failing its own evidentiary standard,
which suggests the `[VERIFIED]/[DOCUMENTED]/[UNVERIFIED]` discipline needs applying to
_proposed mitigations_, not just to upstream API claims. That rule is now stated in §8.4.

---

## 11. Evidence Appendix

All checks run 2026-07-24 with UA `osrs-clan-toolkit-research - PRD feasibility check`.

| Check                                                     | Result                                                                           |
| --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `GET /api/v1/osrs/latest?id=20997`                        | `200` — `{"high":1478143929,"highTime":...,"low":1476000000,...}`                |
| `GET /api/v1/osrs/mapping`                                | `200` — 849,840 bytes; fields incl. `lowalch`, `highalch`, `limit`, `value`      |
| `GET /timeseries` × 4 timesteps                           | 365 points each; spans **2.3d / 15.3d / 91.3d / 364.0d**                         |
| `GET index_lite.json?player=Lynx Titan`                   | `200`; **no `Access-Control-Allow-Origin` header**; 24 skills, **90 activities** |
| Hiscores activity filter (`clue\|achieve\|diary\|combat`) | Only 7 clue entries. **No Combat Achievements, no Diaries**                      |
| Bucket `infobox_item` query                               | `200` — `{"item_id":["1127"],"high_alchemy_value":39000,"buy_limit":70}`         |
| Bucket wrong field names (`highalch`, `monster_name`)     | Errors — field names must be introspected                                        |
| Bucket `infobox_monster` schema                           | 55 fields incl. full combat stats, `attack_speed`, `elemental_weakness`          |
| `api.github.com/repos/osrsbox/osrsbox-db`                 | **last commit 2021-09-30**, pushed 2022-08-07, GPL-3.0                           |
| `api.github.com/repos/weirdgloop/osrs-dps-calc`           | **last commit 2026-07-23**, GPL-3.0                                              |
| `api.github.com/repos/wise-old-man/wise-old-man`          | **last commit 2026-07-24**, MIT                                                  |
| `GET templeosrs.com/api_doc.php`                          | **HTTP 403** — could not verify                                                  |

**Sources:** [Real-time Prices](https://oldschool.runescape.wiki/w/RuneScape:Real-time_Prices) · [Prices FAQ](https://prices.runescape.wiki/osrs/faqs) · [Bucket](https://oldschool.runescape.wiki/w/RuneScape:Bucket) · [WOM API docs](https://docs.wiseoldman.net/api) · [wise-old-man](https://github.com/wise-old-man/wise-old-man) · [osrs-dps-calc](https://github.com/weirdgloop/osrs-dps-calc) · [osrsbox-db](https://github.com/osrsbox/osrsbox-db) · [Discord OAuth2](https://docs.discord.com/developers/topics/oauth2) · [TempleOSRS](https://templeosrs.com/api_doc.php) · [osrs-json-hiscores](https://github.com/maxswa/osrs-json-hiscores)
