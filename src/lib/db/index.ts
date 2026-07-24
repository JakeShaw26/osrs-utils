import 'server-only';
import { neon } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { getEnv } from '@/lib/env';
import * as schema from './schema';

/**
 * Database client.
 *
 * DATABASE_URL must be the POOLED connection string. Every serverless
 * invocation opens its own connection while Postgres' max_connections stays
 * fixed, so the direct endpoint runs out under concurrency. This fails only
 * under load — never in local development — which is the worst possible time
 * to discover it. (PRD §4.2)
 *
 * Construction is lazy for the same reason env validation is: building the
 * client at module scope would read DATABASE_URL during `next build`, which
 * imports route modules without a runtime environment. Call getDb() inside a
 * handler, never at module scope.
 *
 * The neon-http driver suits our access pattern — short, stateless queries per
 * request. If we later need multi-statement transactions or LISTEN/NOTIFY,
 * switch to the WebSocket driver.
 */
type Database = NeonHttpDatabase<typeof schema>;

let cached: Database | undefined;

export function getDb(): Database {
  if (!cached) {
    cached = drizzle(neon(getEnv().DATABASE_URL), { schema });
  }
  return cached;
}

export { schema };
