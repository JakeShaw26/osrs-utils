# Local database setup

The app runs against **Postgres in Docker** for local development. No paid
service, nothing to sign up for, and the data lives in a Docker volume on your
machine.

## One-time setup

1. **Install Docker Desktop** and start it. `docker info` should print a server
   version rather than an error — if it does not, Docker is installed but not
   running.
2. **Copy the database lines from [`.env.example`](../.env.example)** into
   `.env.local`. They are correct as written; no editing needed:

   ```
   DATABASE_URL="postgresql://osrs:localdev@localhost:5432/osrs"
   DATABASE_URL_UNPOOLED="postgresql://osrs:localdev@localhost:5432/osrs"
   ```

3. **Start Postgres and apply the schema:**

   ```bash
   npm run db:up
   npm run db:migrate
   ```

That is the whole setup. `db:up` waits for the database to actually accept
connections before returning, so `db:migrate` immediately after is safe.

## Daily commands

| Command             | Does                                                   |
| ------------------- | ------------------------------------------------------ |
| `npm run db:up`     | Start Postgres in the background                       |
| `npm run db:down`   | Stop it. **Data survives** — the volume is not removed |
| `npm run db:reset`  | Destroy the volume, recreate, re-migrate. Data is gone |
| `npm run db:logs`   | Tail Postgres logs                                     |
| `npm run db:psql`   | Open a `psql` shell inside the container               |
| `npm run db:studio` | Drizzle Studio — a browser UI over the tables          |

## Two drivers, and why

This is the part most likely to confuse, so it is worth understanding rather
than working around.

`@neondatabase/serverless` **does not speak the Postgres wire protocol.** It
sends each query as an HTTP request to Neon's endpoint. That sounds like a
strange thing to want, and it is the right call in a serverless runtime:

- A normal Postgres client opens a **TCP connection** and keeps it open.
- Serverless functions scale by running many short-lived instances at once.
- Postgres has a fixed `max_connections`. A few hundred concurrent instances
  each holding a connection exhausts it, and new requests start failing.
- HTTP has no persistent connection to exhaust. Each query is a stateless
  request, which matches how serverless functions actually behave.

The cost is that the driver only talks to Neon. Pointed at `localhost:5432` it
fails, because there is no HTTP API there — only Postgres.

So [`src/lib/db/index.ts`](../src/lib/db/index.ts) picks a driver from the
connection URL: **loopback host → `node-postgres`** (real protocol, real
connection pool), **anything else → the Neon HTTP driver**. Both run the same
migrations and the same Drizzle queries; only the transport differs.

The check is deliberately "is it my machine?" rather than "is it Neon?". If it
matched on Neon, every other hosted provider — Supabase, RDS — would silently
fall through to the local driver, and that mistake surfaces as connection
exhaustion under production load rather than as an error you can see. An
unrecognised host gets the serverless driver, which is correct everywhere we
would deploy.

## Pooled vs unpooled

In production these are two different URLs and the distinction matters
(`DATABASE_URL` pooled for the app, `DATABASE_URL_UNPOOLED` direct for
migrations — DDL needs a real session, which a transaction pooler cannot
provide).

**Locally they are the same string**, because there is no pooler in front of
your container. Both variables are still set so the code paths match production.

## Security notes

The password `localdev` is committed in `docker-compose.yml` on purpose. It
protects nothing: the port is bound to `127.0.0.1`, so only this machine can
reach it. Putting a realistic-looking fake secret there instead would teach the
habit of committing real ones.

Two things in the compose file that are easy to get wrong:

- **`127.0.0.1:5432:5432`, not `5432:5432`.** The short form binds to every
  interface, so the database is reachable from any device that can route to
  your machine — including everyone on a coffee-shop wifi. Docker also writes
  its own firewall rules on Linux, which routinely bypass a host firewall.
- **The image is pinned to a digest**, not `:latest` or `:17`. A floating tag
  means your database silently changes version on some future pull, and "it
  worked yesterday" becomes a version difference invisible in the diff.

## Troubleshooting

**`port is already allocated`** — something else is on 5432, usually a
previously installed Postgres running as a Windows service. Either stop that
service, or change the host side of the port mapping (`127.0.0.1:5433:5432`)
and update both URLs in `.env.local` to `:5433`.

**`ECONNREFUSED` from `db:migrate`** — Docker Desktop is not running, or the
container is not up. Check `docker compose ps`.

**`getEnv()` throws about `DATABASE_URL`** — `.env.local` is missing the line.
Note that `.env.example` is a template and is not read at runtime.

**Migrations applied but tables missing** — you may have migrated one database
and connected to another. `npm run db:psql`, then `\dt` to list tables.
