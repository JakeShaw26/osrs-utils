# ADR-0012: No authentication — a public, read-only app

- **Status:** Accepted
- **Date:** 2026-07-24
- **Deciders:** Repository owner
- **Supersedes:** [ADR-0010](./0010-no-discord-bot.md) (Discord as identity
  provider), [ADR-0005](./0005-rsn-verification-method.md) (RSN link approval)
- **Amends:** [ADR-0001](./0001-serverless-nextjs-architecture.md) (storage),
  [ADR-0002](./0002-delegate-tracking-to-wise-old-man.md) (scope of delegation)

## Context

The PRD made Discord OAuth the MVP gate: sign-in established identity, and the
member's Discord roles established their rank, which drove authorisation.
ADR-0010 kept that while removing the bot.

The owner has now decided to **remove authentication entirely**. Four drivers,
all given directly:

1. Creating a Discord application and registering redirect URIs is setup friction.
2. Asking clan members to authorise a third-party app against their Discord
   account is a barrier and a trust cost.
3. Most tools here — GE margins, DPS, skilling rates — do not need to know who
   you are, and gating them suppresses adoption.
4. A hard dependency on Discord's scopes, rate limits and terms is a standing
   risk to the whole app's auth model.

The owner further observed that **clan roster, ranks and competitions are
available from other APIs**. That claim was the load-bearing one, because
without it this decision would have deleted the entire clan layer. It was
verified rather than assumed.

### Verification — Wise Old Man group endpoints (2026-07-24)

Probed unauthenticated, no API key, with a compliant User-Agent, against public
group `82` (488 members — comparable to our ≤500 assumption):

| Endpoint                                   | Status | Result                                               |
| ------------------------------------------ | ------ | ---------------------------------------------------- |
| `GET /v2/groups?limit=3`                   | 200    | Group search works anonymously                       |
| `GET /v2/groups/82`                        | 200    | **All 488 memberships in one 283 KB response**       |
| `GET /v2/groups/82/competitions`           | 200    | 150 competitions, with `metric`, dates, participants |
| `GET /v2/groups/82/gained?metric=&period=` | 200    | 485 ranked rows — a finished leaderboard             |

Three findings that changed the design rather than merely confirming it:

- **`memberships[].role`** carries real OSRS clan ranks (`owner`,
  `deputy_owner`, `moderator`, … `recruit`, `gnome_child`) — not generic ones.
  Rank display maps directly onto them.
- **`roleOrders`** returns the clan's _own_ rank ordering as `{role, index}`
  pairs. The rank hierarchy is therefore **clan-supplied data, not a hardcoded
  ladder**, so rank changes need no code change. This is strictly better than
  the `tiers.ts` constant it replaces.
- **`memberships[].player`** already embeds `exp`, `ehp`, `ehb`, `ttm` and
  `updatedAt`. A total-XP leaderboard needs **zero** further requests.

The whole clan layer is one request per view. Hard rule #4 (no fan-out) is
satisfied by construction rather than by discipline.

## Decision

**The app has no user accounts, no sessions, and no authentication. It is
public and read-only to every visitor.**

Two rules follow, and they are the entire security model:

1. **No public write path exists.** The only writers are scheduled jobs
   authenticated by `CRON_SECRET`, and build-time fetches. A route handler that
   mutates state in response to an anonymous request is a defect, not a feature.
2. **Personal data never reaches the server.** Anything per-user — flip logs,
   timers, gear setups, self-declared diaries — lives in the browser
   (`localStorage`/IndexedDB), owned by the member, invisible to us.

Clan identity comes from the **Wise Old Man group ID**, held in configuration.
Membership of that group _is_ the roster.

## Consequences

### Good

- **The largest class of vulnerability is designed out, not defended against.**
  With no accounts there is no session fixation, no privilege escalation, no
  broken access control (OWASP A01), no credential storage (A07), no password
  reset flow, no account takeover. The remaining surface is injection and
  supply chain.
- **Removes the ongoing rank-maintenance chore.** The earlier concern was that
  dropping Discord roles meant an officer hand-maintaining tiers forever. WOM
  `roleOrders` removes it: the clan already maintains its WOM group.
- **Zero friction.** No consent screen, no sign-up, nothing to explain. Every
  tool is a shareable URL, which for a clan pasting links into Discord is
  precisely the right shape.
- **Everything is cacheable.** No per-user variation means responses cache at
  the edge for all visitors. Fewer upstream calls, better ToS compliance
  (self-limiting, per `docs/api-terms.md`), faster pages.
- **Cuts ~10 of 14 database tables** and deletes the auth module entirely.

### Bad

- **The open-proxy risk loses its mitigation, and this is the sharpest edge of
  the decision.** PRD review finding M2 established that per-user rate limiting
  is meaningless for anonymous traffic; the accepted fix was "hiscores lookup
  requires login". There is no login now, so that fix is void and the risk
  applies to _all_ traffic rather than an edge case. Any endpoint proxying an
  upstream API lets a stranger hammer Jagex or the Wiki **from our IP**, and it
  is we who get blocked — a direct breach of the self-limiting rule in
  `docs/api-terms.md`. Replacement controls, all mandatory before the first such
  endpoint ships: edge/IP rate limiting, a cache shared across all visitors, and
  a preference for scheduled pre-aggregation over on-demand proxying. Caching is
  now a security control, not a performance nicety. See PRD §5.3.
- **Officer-only views are impossible.** Not "hard" — impossible. Anything not
  fit for public view must not be built. Hiding it client-side would be the
  exact OWASP A01 failure hard rule #5 was written to prevent.
- **Custom clan events (bingo boards, tile completions) are lost.** They need
  trusted writes from known members. WOM competitions cover the common case;
  bespoke events do not survive.
- **Self-declared trackers lose durability.** Combat Achievements, diaries and
  quests are absent from the hiscores, so they were always member-declared;
  they now live in browser storage and vanish when a member clears it or
  switches device. Export/import is the mitigation.
- **RSN linking is obsolete, not replaced.** With no accounts there is no
  Discord user to link an RSN _to_. ADR-0005's officer approval queue is
  deleted. Members are identified by RSN alone.
- **Rank accuracy inherits WOM's.** If the clan lets its WOM group drift, our
  ranks drift with it. We surface `updatedAt` rather than implying freshness.
- **We cannot personalise.** No "your progress" without the member typing their
  RSN — which becomes a stored preference in the browser.

### Neutral

- **The database survives, but only just.** Two tables remain: `daily_snapshots`
  (so a WOM outage degrades the clan layer to _stale_ rather than _empty_) and
  `job_state` (a resumable cursor, because serverless invocations get killed
  mid-run). Both are keyed by RSN, not by account, so neither depended on auth.
  Everything else is a cache of upstream data and belongs in the fetch layer.
  If the outage-resilience requirement were dropped, the database could go too.
- Reversible in principle, but not cheaply: reintroducing auth means restoring
  the deleted module (preserved in commit `5202810`) and rebuilding identity.

## Alternatives considered

| Alternative                                     | Why not chosen                                                                                                                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Keep Discord OAuth** (ADR-0010)               | Rejected by the owner on all four drivers above. Its unique advantage — auto-synced ranks — turns out to be matched by WOM `roleOrders` without any sign-in.              |
| **Google OAuth + officer-assigned tiers**       | Recommended before the WOM verification: avoids password storage, keeps the clan layer. Made unnecessary once ranks proved fetchable anonymously.                         |
| **Email magic link**                            | Owns identity end to end, but adds an email provider, token expiry handling, and a personal-data store — cost with no remaining benefit.                                  |
| **Public tools + a small authenticated island** | Sign-in only for events/officer views. Rejected: reintroduces the entire auth surface for the least-used features, and "mostly public" is a harder model to reason about. |

## Verification still required

- **The clan's own WOM group ID, and whether it is kept current.** Everything
  clan-facing depends on it. If the group is stale or absent, the clan layer is
  wrong rather than merely empty. **New open question V14.**
- **WOM rate limits for anonymous reads at our cadence** (V5 remains open). The
  283 KB roster response is large; it must be cached server-side, not fetched
  per visitor.

## Revisit if

- The clan wants events, bingo, or anything requiring trusted member writes.
- Anything genuinely officer-only becomes necessary.
- WOM restricts anonymous group reads or the clan stops maintaining its group.
