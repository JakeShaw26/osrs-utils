import 'server-only';
import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeon, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { drizzle as drizzleNode } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { getEnv } from '@/lib/env';
import * as schema from './schema';

/**
 * Database client.
 *
 * TWO DRIVERS, CHOSEN BY CONNECTION TARGET
 *
 * `@neondatabase/serverless` does not speak the Postgres wire protocol. It
 * sends each query as an HTTP request to Neon's endpoint, which is what makes
 * it viable in a serverless runtime: there is no TCP connection to exhaust
 * `max_connections` with, and no socket to leak between invocations.
 *
 * The cost is that it only talks to Neon. Pointed at a local Postgres it fails,
 * because there is no HTTP API on 5432 — only Postgres. So local development
 * uses `node-postgres`, which speaks the real protocol, and anything else uses
 * the Neon driver. `isLocalPostgres` is the whole of the decision.
 *
 * This is not a fork in behaviour: both are Postgres, both run the same
 * migrations, and Drizzle's query builder is identical across them. Only the
 * transport differs.
 *
 * WHY THE TYPE IS THE NEON ONE, NOT A UNION
 *
 * A union of the two database types does not typecheck at the call site: TS
 * resolves a call on a union of signatures to their intersection, and the two
 * builders' generics differ enough that ordinary `.insert().returning()` chains
 * stop resolving.
 *
 * Declaring the **Neon** type and casting the local driver is the deliberate
 * direction of the two available lies. neon-http is the more constrained
 * driver — notably it cannot run an interactive multi-statement transaction —
 * and it is the one production uses. Typing against it means code that would
 * fail in production fails to compile locally. Typing against node-postgres
 * would do the reverse: local development would happily accept transactions
 * that break on deploy, which is the failure this codebase already works hard
 * to avoid elsewhere (see the pooled-connection note above).
 *
 * DATABASE_URL must be the POOLED connection string in a serverless runtime.
 * Every invocation opens its own connection while Postgres' max_connections
 * stays fixed, so the direct endpoint runs out under concurrency. This fails
 * only under load — never in local development — which is the worst possible
 * time to discover it. (PRD §4.2)
 *
 * Construction is lazy for the same reason env validation is: building the
 * client at module scope would read DATABASE_URL during `next build`, which
 * imports route modules without a runtime environment. Call getDb() inside a
 * handler, never at module scope.
 */
type Database = NeonHttpDatabase<typeof schema>;

/**
 * Loopback only, deliberately narrow.
 *
 * Matching on "is it Neon?" would silently fall back to the local driver for
 * any other managed provider — Supabase, RDS — and that mistake surfaces as a
 * connection-pool exhaustion under load, not as an error. Matching on "is it
 * my machine?" fails the safe way instead: an unrecognised host gets the
 * serverless driver, which is the correct default everywhere we would deploy.
 */
function isLocalPostgres(url: string): boolean {
  try {
    // URL.hostname keeps the brackets on an IPv6 literal ("[::1]"), so a plain
    // comparison against "::1" never matches. Caught by a test, not by reading.
    const hostname = new URL(url).hostname.replace(/^\[|\]$/g, '');
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}

let cached: Database | undefined;

export function getDb(): Database {
  if (!cached) {
    const url = getEnv().DATABASE_URL;

    cached = isLocalPostgres(url)
      ? // A Pool rather than a Client: `next dev` handles requests concurrently,
        // and a single Client serialises them, so one slow query would block
        // every other request behind it.
        //
        // The cast is the one described above: structurally these builders are
        // the same for every query this app makes, and the Neon type is the
        // stricter of the two.
        (drizzleNode(new Pool({ connectionString: url }), {
          schema,
        }) as unknown as Database)
      : drizzleNeon(neon(url), { schema });
  }
  return cached;
}

export { isLocalPostgres, schema };
