# ADR-0010: No Discord bot — OAuth only

- **Status:** **Superseded by
  [ADR-0012](./0012-no-authentication-public-read-only.md)** (2026-07-24)
- **Date:** 2026-07-24
- **Deciders:** Repository owner

> **Superseded.** Discord was removed entirely — not just the bot, but OAuth
> too. The app has no authentication at all. Retained because its reasoning is
> still instructive: the V11 analysis below shows how to distinguish a
> documented precondition from an absent one, and the capability-replacement
> table applies to any future Discord integration.
>
> The empirical V11a check described at the bottom was **never run**, and the
> script that ran it has been deleted. If Discord is ever reintroduced, that
> check is still outstanding.

## Context

The PRD assumed a Discord bot would arrive in P3, serving three jobs: farm-run
reminder DMs, event announcements, and (per the earlier ADR-0006 draft)
scheduling work that does not fit serverless execution limits.

The owner has decided **there is no bot in the clan guild and no plan to add
one.** That removes an assumed capability from three separate features, so the
consequences are recorded here rather than discovered during P3.

This also forced resolution of **V11**, previously flagged as blocking P0: does
`guilds.members.read` require our application to be present in the guild as a
bot? If it did, the entire auth model would have depended on a bot we are not
building.

### V11 — resolved

Discord's docs state, for `GET /users/@me/guilds/{guild.id}/member`:

> _"Returns a guild member object for the current user. Requires the
> `guilds.members.read` OAuth2 scope."_

No bot presence is stated as a precondition. Three things make this convincing:

1. The endpoint is under **`/users/@me/`** and is called with a **user access
   token**. It is the user's own resource, not a guild resource.
2. Where Discord _does_ require the app in the guild, **it says so** — the
   `guilds.join` scope documentation states the bot must already belong to the
   guild. The absence of that sentence here is meaningful by contrast.
3. Third-party sign-in providers implement role gating with these scopes without
   requiring a bot install.

**Conclusion: OAuth-only role gating works without a bot.** Confidence high, but
not empirically proven — see "Verification still required" below.

## Decision

**We will not build or deploy a Discord bot. Discord is used solely as an
OAuth2 identity and role provider.**

Consequences accepted for each capability the bot would have provided:

| Capability          | Replacement                                           |
| ------------------- | ----------------------------------------------------- |
| Auth + role gating  | **Unaffected** — OAuth scopes are sufficient          |
| Farm-run reminders  | **Web Push** (service worker), or in-page timer only  |
| Event announcements | **Discord incoming webhook** — a URL, no bot required |
| Job scheduling      | Platform cron or an external trigger (see ADR-0006)   |

**Incoming webhooks are the key mitigation**: Discord lets a channel expose a
webhook URL that any HTTP client can POST to. That covers announcements with no
bot, no gateway connection and no always-on host.

**Webhooks cannot DM users**, only post to a channel. Personal reminders
therefore move to Web Push, which is the one genuine capability loss.

## Consequences

### Good

- **Removes an entire always-on service** from the architecture: no gateway
  connection, no bot host, no bot token to rotate, ~£4/mo saved.
- Removes a whole category of permission and moderation risk — a bot in a clan
  server is a standing security surface, and we now have none.
- Simplifies P3 considerably.
- Members need not trust a bot with server-side permissions; OAuth consent is
  per-user and revocable by them.

### Bad

- **Personal reminders get materially worse.** Web Push requires an explicit
  browser permission prompt, is unreliable on iOS unless the site is installed
  to the home screen, and is easy to dismiss forever by accident. A Discord DM
  would have been near-100% delivery to an audience already living in Discord.
  This is the real cost of the decision.
- **Lost the cheap scheduler.** ADR-0006's preferred option was to schedule from
  the always-on bot host; that option no longer exists, so scheduling must come
  from the hosting platform or an external trigger.
- Announcements via webhook are one-way; no slash commands, no interactive
  clan-facing features in Discord itself.

### Neutral

- Reversible. Adding a bot later is additive and would not require unpicking the
  auth model, since OAuth role gating stands on its own.

## Alternatives considered

| Alternative                                 | Why not chosen                                                                                                                                                                     |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bot for reminders + announcements only**  | Best delivery, and the announcements half is genuinely nice. Rejected by the owner: an always-on service and a standing permissions surface is disproportionate for reminder DMs.  |
| **Bot solely as a fallback for role reads** | Unnecessary — V11 resolved in favour of OAuth-only, so it would buy nothing.                                                                                                       |
| **Email reminders**                         | No extra Discord surface, decent delivery. Requires collecting email addresses (more personal data to protect) and an email provider. Reconsider if Web Push adoption proves poor. |
| **In-page timers only, no push at all**     | Simplest, zero infrastructure. A farm-run timer that cannot notify you is close to pointless, so Web Push is worth the effort.                                                     |

## Verification still required

**Before P0 auth work, confirm OAuth-only role reads empirically** — roughly ten
minutes: create a throwaway Discord application, do _not_ add it to the guild,
authorise with `identify guilds guilds.members.read`, and call
`GET /users/@me/guilds/{guild.id}/member`. A `200` with a `roles` array
confirms it. Anything else reopens this ADR immediately, because the entire auth
model depends on it.

The reasoning above is strong but is inference from documentation structure, not
an observed response — and PRD §8.4 requires that distinction be stated rather
than blurred.

## Revisit if

- Web Push adoption is poor and members miss farm runs → reconsider a
  reminder-only bot, or email.
- The clan wants interactive Discord features (slash commands, in-Discord
  leaderboards).
- The empirical check above fails.
