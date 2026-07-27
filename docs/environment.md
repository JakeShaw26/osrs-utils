# Environment setup — `.env.local`

How to get every value the app needs, and what each one actually does.

[`.env.example`](../.env.example) is the template and explains _why_ each
variable exists. This page covers _how to obtain_ the values, and how to tell
when you have them right.

---

## The five-minute version

```bash
npm install
cp .env.example .env.local
```

Then fill in four required values (the rest have working defaults):

| Variable              | Where it comes from                                |
| --------------------- | -------------------------------------------------- |
| `WOM_GROUP_ID`        | Already correct — `25092`. Nothing to do.          |
| `DATABASE_URL`        | Neon dashboard → **pooled** connection string      |
| `CRON_SECRET`         | Generate one yourself (command below)              |
| `OSRS_API_USER_AGENT` | Write it yourself — your app name and contact info |

Then check it:

```bash
npm run dev
curl http://localhost:3000/api/health
# {"status":"ok","database":"ok","latencyMs":42}
```

`database: "ok"` means the connection string works. If you get a 503, jump to
[Troubleshooting](#troubleshooting).

> **`.env.local` is gitignored and must never be committed.** Nothing in
> `.env.example` is a real secret, which is why that file _is_ committed.

---

## What you need an account for

Exactly one thing: **a Postgres database.** Everything else is either a public
identifier, a string you invent, or optional.

There is no OAuth app to register, no session secret, and no API key you must
obtain — the app has no authentication at all
([ADR-0012](./adr/0012-no-authentication-public-read-only.md)).

---

## Required variables

### `WOM_GROUP_ID` — already filled in

The numeric part of the clan's Wise Old Man URL:

```
https://wiseoldman.net/groups/25092   ->   25092
```

This is the app's entire notion of "the clan": membership of that group **is**
the roster, and the group's own `roleOrders` supply the rank hierarchy. It is
not a secret — it identifies a public group — which is why `.env.example` ships
the real value.

You only change this if the clan moves to a different WOM group.

---

### `DATABASE_URL` — the pooled Postgres connection string

**Use [Neon](https://neon.tech). Its free tier is enough, and right now it is
not really optional** — see the driver note below.

1. Sign up at <https://neon.tech> (GitHub login works).
2. Create a project. Any region; pick the one nearest you.
3. On the project dashboard, find the **connection string** widget.
4. **Enable the pooled/connection-pooling option**, then copy the string.
5. Paste it as `DATABASE_URL` in `.env.local`.

**How to tell you copied the right one:** the pooled host contains `-pooler`.

```
postgresql://user:pass@ep-cool-name-123456-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require
                                            ^^^^^^^
```

If `-pooler` is missing, you have the direct string. UI labels change between
dashboard versions; the `-pooler` substring is the reliable test.

#### Why pooling matters (this is a real bug, not a preference)

A Postgres server allows a fixed maximum number of simultaneous connections —
a few hundred at most, and far fewer on a free tier. A traditional server opens
a handful of connections at startup and reuses them for its whole life.

Serverless is the opposite. Every concurrent request can run in its **own
short-lived instance**, and each one opens its own connection. Fifty
simultaneous visitors means fifty connections, all closing seconds later. The
database runs out and starts refusing connections.

A **pooler** (Neon runs PgBouncer for you) sits in front of the database and
keeps a small set of real connections, handing them out to many clients in
turn. Your app connects to the pooler, and the pooler manages the scarce
resource.

This is hard rule #3 for a specific reason: **it cannot fail on your machine.**
Locally there is one instance and one connection, so the direct string works
perfectly. It only breaks under real concurrency — in production, under load,
which is the worst possible time to discover it.

> **⚠️ Provider note — Neon specifically, for now.** The app uses
> `@neondatabase/serverless` with Drizzle's `neon-http` driver
> ([`src/lib/db/index.ts`](../src/lib/db/index.ts)). That driver talks to
> Neon's SQL-over-HTTP endpoint; it does **not** speak the standard Postgres
> wire protocol, so a Supabase or plain-Postgres URL will not work by simply
> pasting it in. [ADR-0001](./adr/0001-serverless-nextjs-architecture.md) says
> "Neon/Supabase", and that remains true at the architecture level — but
> switching provider now also means switching driver (to `postgres-js` or `pg`).
> Budget for that rather than expecting a one-line change.

---

### `DATABASE_URL_UNPOOLED` — the direct connection, for migrations only

Same dashboard, same project, **pooling turned off** — the string _without_
`-pooler`.

Technically optional: `drizzle.config.ts` falls back to `DATABASE_URL` if it is
missing. In practice, set it. Schema migrations issue DDL (`CREATE TABLE`,
`CREATE INDEX`), which needs a real, stateful session. A transaction pooler
multiplexes statements across connections and cannot guarantee one, so
migrations against the pooled URL fail in confusing ways.

Rule of thumb: **pooled for the app, direct for migrations.**

---

### `CRON_SECRET` — generate it yourself

A random string you invent. It is not issued by any service.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

That works on any platform with Node installed, which you already have. It
produces something like:

```
kJ8xQ2mNvR7pLwZ4tYcB9hF3sD6gA1jE5nK0oI8uT2w
```

Minimum length is 16 characters and the app refuses to start without it. Use
the 32-byte output above rather than something you can remember — a guessable
value here is the same as no value.

#### Why this exists, with no login anywhere in the app

Scheduled jobs (refreshing clan snapshots, pruning rate-limit rows) run by an
external scheduler making an HTTP request to a route in this app. That route is
a **public HTTPS URL** — there is no private network to hide it behind.

Since these jobs are the _only_ writers in the entire system
([ADR-0012](./adr/0012-no-authentication-public-read-only.md)), this shared
secret is the whole write-side security model. Without it, anyone who guesses
the URL can trigger our refresh loop repeatedly and burn the upstream
rate-limit budget on our behalf, until the OSRS Wiki or Jagex blocks our IP.

It is also used as the salt when hashing visitor IPs for rate limiting
([ADR-0013](./adr/0013-rate-limiting-shared-store.md)). Consequence worth
knowing: **rotating it resets all rate-limit buckets**, because every stored key
was derived from the old value. Harmless, but do not rotate it in a loop.

---

### `OSRS_API_USER_AGENT` — write it yourself

Not issued by anyone. It is how we identify ourselves on every outbound
request.

Format:

```
<app>/<version> (+<url>; discord: <handle>)
```

Example:

```
osrs-clan-toolkit/0.1 (+https://github.com/JakeShaw26/osrs-utils; discord: yourhandle)
```

Put a real contact route in it. Minimum length is 10 characters, checked at
startup — but length is all the app can check, so the rest is on you.

⚠️ **The repo URL is not a contact route while the repo is private.** It 404s
for anyone who is not a collaborator, so on its own it identifies us without
being reachable — which is the half that matters. `api-terms.md` rule 4 is
"identify honestly", and an unreachable contact fails it. **The Discord handle
is doing the real work here**; keep one in the string for as long as the repo
stays private.

Fill in your own handle — the `yourhandle` above is a placeholder, and this
file is committed. Real values belong in `.env.local` and nowhere else.

**This is not politeness, it is access.** The OSRS Wiki **pre-emptively blocks**
default agents: `python-requests`, `Python-urllib`, `Apache-HttpClient`,
`RestSharp`, `Java` and bare `curl`. Its operators ask automated clients to
identify themselves with contact info so they can reach you before blocking you.

Being honest here is a binding commitment, not a nicety —
[`docs/api-terms.md`](./api-terms.md), [ADR-0011](./adr/0011-third-party-api-compliance.md).
Never spoof a browser or game client.

---

## Optional variables

### `WOM_API_KEY` — leave empty unless you have one

Raises the Wise Old Man rate limit from **20 to 100 requests/minute**.

Group reads work fine unauthenticated — the whole clan layer needs no key, and
each clan view is one unpaginated request. This is headroom, not a requirement.

To request one: ask in the [Wise Old Man Discord](https://wiseoldman.net). It is
a free community project; be specific about what you are building.

### `RATE_LIMIT_TRUSTED_PROXY_HOPS` — leave at `1`

How many reverse proxies append to `X-Forwarded-For` in front of the app. `1` is
correct for a normal serverless deployment (platform edge → function) and for
local development.

**⚠️ Getting this wrong is a silent security failure, not an error.** The client
IP is read that many entries from the **right** of the header, because
everything to the left of what our own infrastructure appended is text the
caller wrote. Set it too high and we read attacker-supplied text as the client
IP — which hands every request a fresh bucket and disables rate limiting while
it still reports healthy. Too low merely over-limits, which is the safe
direction.

Only change it once a host is chosen and its real topology is known
([ADR-0013](./adr/0013-rate-limiting-shared-store.md),
[`src/lib/ratelimit/identity.ts`](../src/lib/ratelimit/identity.ts)).

### `NODE_ENV`

Set automatically by Next.js. Do not put it in `.env.local`.

---

## Applying database migrations

`.env.local` alone does not create the tables. After filling it in:

```bash
npm run db:migrate
```

There are currently two migrations, including `rate_limit_counters`. Until they
are applied, `enforceRateLimit()` **fails open on every request** — it allows
traffic and sets `degraded: true` rather than erroring, which is safe but is not
rate limiting.

```bash
npm run db:studio   # browse the tables to confirm they exist
```

---

## Verifying the whole setup

```bash
npm run dev
curl http://localhost:3000/api/health
```

| Response                                      | Meaning                               |
| --------------------------------------------- | ------------------------------------- |
| `{"status":"ok","database":"ok",...}`         | Everything works                      |
| `{"status":"error","database":"unreachable"}` | App runs, `DATABASE_URL` is wrong     |
| Startup error naming a variable               | That variable is missing or malformed |

`npm run check` passes **without** any environment at all — that is deliberate,
and CI relies on it. Tests and the build never read real secrets, so a green
`check` tells you nothing about whether `.env.local` is correct. Use
`/api/health` for that.

---

## Troubleshooting

**`Invalid environment variables: - DATABASE_URL: Invalid url`**
The value must include the scheme. `postgresql://…`, not `ep-xxx.neon.tech`.

**`Invalid environment variables: - CRON_SECRET: String must contain at least 16 character(s)`**
Placeholder still in place. Generate one with the command above.

**Health check returns 503, `database: "unreachable"`**
In likelihood order: the Neon project is suspended (free tier idles — open the
dashboard to wake it); `sslmode=require` was dropped from the string; the
password contains a character that needs URL-encoding; or you pasted a
non-Neon URL, which the `neon-http` driver cannot use at all.

**Migrations fail but the app works**
You are missing `DATABASE_URL_UNPOOLED`, so `drizzle-kit` fell back to the
pooled URL. DDL needs the direct connection.

**Everything worked yesterday, now the environment is missing**
`.env.local` is gitignored, so it does not survive `git clone`, and it is
**absent from every new git worktree**. See below.

---

## Git worktrees (Phase B)

Parallel feature agents each work in their own git worktree. Because
`.env.local` is gitignored, **a fresh worktree has no environment file** and
nothing in it can reach the database.

Copy it in after creating each worktree:

```bash
cp .env.local ../<worktree-dir>/.env.local
```

Each worktree also needs its own `npm install` (~546 MB).

---

## Deployment

The same variables go in the **hosting platform's** environment settings, not in
a file. `.env.local` is for local development only and is never deployed.

Hosting is deliberately undecided
([ADR-0006](./adr/0006-hosting-tier-and-scheduled-jobs.md)), so there is no
platform-specific guide yet. Two things will apply wherever it lands:

- Use the **pooled** `DATABASE_URL`. The reasoning above applies more in
  production, not less.
- Check `RATE_LIMIT_TRUSTED_PROXY_HOPS` against the platform's actual proxy
  topology before trusting the rate limiter.

---

## Rules that are not negotiable

1. **Never commit `.env.local`.** It is gitignored; keep it that way. If a
   secret is ever committed, rotate it — git history is forever, and removing
   the file in a later commit does not remove it from history.
2. **Never prefix a secret with `NEXT_PUBLIC_`.** Next.js inlines those into the
   JavaScript bundle it sends to every visitor. `NEXT_PUBLIC_` means "publish
   this", and it is not reversible after deployment.
3. **Never read secrets at module scope.** Call `getEnv()` and `getDb()` _inside_
   functions. Module scope runs during `next build`, where secrets legitimately
   do not exist — this has broken the build before.
4. **Never paste a real connection string into an issue, a PR or a chat**,
   including with an AI assistant. Share the shape, never the value.
