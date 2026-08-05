# Third-party API terms & compliance

**Binding on this project.** Every data source we use belongs to someone else,
and none of them owe us access. This file records what each provider's terms
actually say and the concrete rules we follow as a result.

**Last reviewed:** 2026-07-24 · **Review cadence:** before each phase

> **For agents:** treat the Rules sections as hard constraints, on a level with
> "don't commit secrets". If a task appears to require breaking one, stop and
> flag it rather than proceeding.

---

## 1. Jagex (hiscores, game data)

**Source:** [Terms & Conditions](https://legal.jagex.com/docs/terms/terms-and-conditions) ·
[Rules of OSRS](https://legal.jagex.com/docs/rules/rules-of-old-school-runescape) ·
[Third Party Client Guidelines](https://oldschool.runescape.wiki/w/Update:Third_Party_Client_Guidelines)

### What the terms actually say

- **§15 Third Party Software:** _"Jagex does not recommend, endorse or authorise
  the use of such Third-Party Software."_ Tolerated, not blessed. No warranties,
  and Jagex _"expressly reserves the right, at any time, to restrict user
  access… if Third-Party Software is used."_
- **§6:** users may not _"commercially exploit, adapt, translate, modify, bundle,
  merge, share or make available to any person, or create derivative works of
  the Jagex Product."_
- **§7:** all IP in the game and its data _"remain the property of Jagex and/or
  its licensors."_ Players get only limited personal-use permission.
- **No published API policy.** There is no document explicitly permitting or
  forbidding programmatic hiscores access. The endpoint is public and
  unauthenticated, and large sites (Wise Old Man, TempleOSRS) have operated on
  it openly for years — so tolerance is evidently high.

### Our position

**Tolerated ≠ licensed.** We rely on Jagex's forbearance, which can be withdrawn
at any time. We therefore behave as a well-mannered guest, and we design so that
losing hiscores access degrades the app rather than breaking it.

### Rules

1. **Read-only, public data only.** Only the public hiscores endpoint, only for
   RSNs a member has voluntarily linked. Never authenticate as a player, never
   touch account data.
2. **Non-commercial.** No ads, no paid tiers, no selling data or access. §6
   forbids commercial exploitation, and this is the clause most likely to be
   enforced against us.
3. **Rate-limit ourselves.** No published limit means assume a low one. Cache
   ≥5 min per RSN; never fan out across members in a request path; hiscores
   lookup requires login so limits key to a user rather than an open proxy.
4. **Identify honestly.** Descriptive User-Agent with contact info on every
   request. Never spoof a browser or a game client.
5. **Treat 403/429 as expected.** Back off exponentially. Never retry-storm.
6. **No gameplay automation.** We are a website. We never interact with the game
   client, never automate play, never assist botting. This is the line that
   gets accounts banned and the one we most clearly stay behind.
7. **No alternative client or emulator** (§7).
8. **Attribution + disclaimer.** State that we are unaffiliated with Jagex.

---

## 2. OSRS Wiki (prices, Bucket, images)

**Source:** [Real-time Prices](https://oldschool.runescape.wiki/w/RuneScape:Real-time_Prices) ·
[Prices FAQ](https://prices.runescape.wiki/osrs/faqs)

### What the terms actually say

- **Text content is CC BY-NC-SA 4.0** — attribution, non-commercial, share-alike.
- **⚠️ Images are NOT.** [RuneScape:Images](https://oldschool.runescape.wiki/w/RuneScape:Images)
  states they are _"used under the fair use license"_ and remain Jagex's
  property. **Fair use is a defence, not a licence** — it is assessed per use and
  does not transfer to downstream reusers. Assuming the page footer's CC licence
  covers the pictures on the page is the easy mistake here, and any npm package
  that ships wiki images under a CC licence is making it. (ADR-0021)
- **User-Agent is the one hard requirement.** The wiki asks only this, and
  **pre-emptively blocks** default agents: `python-requests`, `Python-urllib`,
  `Apache-HttpClient`, `RestSharp`, `Java`, bare `curl`.
- **No explicit rate limit**, but they _"reserve the right to limit access to
  anyone if usage… threatens the stability of the entire API."_ Their stated
  threshold is "multiple large queries per second for a sustained period".

### Rules

1. **Always send a descriptive User-Agent with contact info.** Format:
   `osrs-clan-toolkit/<version> (+<url>; discord: <handle>)`. Centralised in
   `src/lib/api/osrs-fetch.ts` — never call these hosts with bare `fetch()`.
   A lint rule enforces this.
2. **Bulk over per-item.** Fetch `/latest` once and serve everyone from a shared
   cache. Never one request per item or per user.
3. **Cache per PRD §4.3**: prices 60s shared, `/mapping` 24h (850KB — fetching
   it per request is abuse), Bucket at build time.
4. **Attribution required** (CC BY): credit the OSRS Wiki wherever its data is
   displayed, and link the licence.
5. **Non-commercial only** (CC NC). This clause, combined with Jagex §6,
   **forecloses monetising this project.** Accepted deliberately.
6. **Share-alike (SA)** applies to adapted _content_, not to our source code.
7. **Never hotlink assets.** Every image we display is served from our own
   origin. Item icons are downloaded by `scripts/generate-item-icons.mjs` in one
   throttled hand-run (ADR-0021), then packed into committed atlas sheets by
   `scripts/pack-item-icons.mjs` (ADR-0022); map tiles remain unresolved (PRD
   V7). Hotlinking spends their bandwidth on our traffic every time a page
   renders. **The generator must never run in CI or at build** — that is ~4,600
   requests per build, which is the sustained load this section exists to
   prevent. The committed atlas is what makes that unnecessary: the build has
   every icon already and reaches the wiki zero times.
8. **The icon filename comes from `/mapping`'s `icon` field, never from the item
   name.** 294 of 4,650 differ — `Acorn` is drawn by `Acorn 5.png` — and each
   mismatch is a silent 404.

> Their limits are **goodwill, not contract**. Getting blocked affects the whole
> clan's IP, and the block would be entirely deserved.

---

## 3. Wise Old Man

**Source:** [API docs](https://docs.wiseoldman.net/api) ·
[GitHub](https://github.com/wise-old-man/wise-old-man) (MIT)

### What we know

- **Documented rate limit: 20 requests / 60 seconds**, raised to **100** with a
  free API key.
- Code is **MIT licensed** — permissive, and self-hosting is allowed if we ever
  need an escape hatch.
- **[UNVERIFIED]** their stance on a third-party app driving scheduled group
  updates (PRD V5). `wiseoldman.net/terms` returned HTTP 403 to automated
  fetching, so this must be confirmed with a human visit or via their Discord.

### Rules

1. **Register an API key** before P3. It is free and 5× the limit.
2. **Never exceed 20 req/min without a key.** At 500 members a per-member loop
   is ~25 minutes — never do this in a request path (PRD §4.3).
3. **Prefer group-level endpoints** over per-member calls (pending PRD V10).
4. **Attribute WOM** wherever their data is shown.
5. **Ask before scheduling bulk updates.** Confirm V5 with the maintainers
   before P3. They are approachable; asking costs nothing and being the app
   that hammered their API costs a lot.
6. **Back off on 429** rather than retrying immediately.

---

## 4. TempleOSRS

**Source:** [API docs](https://templeosrs.com/api_doc.php) — **returned HTTP 403
to automated fetch; unverified** (PRD V2).

### Rules

1. **Verify the terms manually before writing any integration.** We have not
   read them. Do not build against this source on assumption.
2. Their guidance (via search) asks callers to **request only needed data** —
   their collection log endpoints return large payloads.
3. Data is **opt-in and plugin-sourced**, so coverage is partial. Display
   per-member sync freshness; never imply an authoritative clan-wide figure.

---

## 5. Discord — no longer used

**We do not call the Discord API at all** ([ADR-0012](./adr/0012-no-authentication-public-read-only.md)).
There is no OAuth application, no bot, no stored tokens, and no Discord data of
any kind. The Developer ToS therefore does not bind us.

The compliance consequence is the useful part: **we hold no personal data**. No
Discord IDs, no usernames, no avatars, no tokens. Deletion requests are
trivially satisfied because there is nothing to delete, and a breach of our
database would expose public game statistics and nothing else.

If Discord is ever reintroduced, the previous rules applied and should be
restored: minimum scopes (`identify`, `guilds`, `guilds.members.read`), store
the minimum, treat tokens as credentials (server-side, encrypted at rest, never
JS-readable), honour deletion, and respect `X-RateLimit-*`.

---

## 6. Standing rules (all sources)

1. **Identify honestly** in every outbound request.
2. **Cache aggressively.** The politest request is the one we don't send.
3. **Never fan out across members** in a user-facing request path.
4. **Degrade, don't break.** Any upstream may vanish or block us; the app should
   show stale-or-absent data rather than error out.
5. **Non-commercial.** Locked in by Jagex §6 and the wiki's CC-NC.
6. **Attribute everyone** whose data we display.
7. **When terms are unread or unclear, do not proceed on assumption** — mark it
   `[UNVERIFIED]` in PRD §9.1 and check first.

## Attribution block (for the site footer)

> Game data from the [OSRS Wiki](https://oldschool.runescape.wiki), used under
> [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).
> Player tracking data from [Wise Old Man](https://wiseoldman.net).
> Old School RuneScape is a trademark of Jagex Ltd. This site is not affiliated
> with, endorsed by, or sponsored by Jagex.

## Open items

| #   | Item                                                                                                                         | Owner                      |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| V1  | No Jagex document permits or forbids programmatic hiscores use. Stance: rely on tolerance, stay non-commercial and read-only | Ongoing                    |
| V2  | TempleOSRS terms unread (403)                                                                                                | Before collection log work |
| V5  | WOM stance on scheduled group updates                                                                                        | Before P3                  |
| V6  | Whether CC-NC extends to API data (moot while non-commercial)                                                                | Only if monetising         |
| V7  | Wiki map tile usage terms                                                                                                    | Before the map feature     |
