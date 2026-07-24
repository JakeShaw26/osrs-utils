import { defineConfig } from 'drizzle-kit';

/**
 * Migrations use the DIRECT (unpooled) connection: DDL needs a real session,
 * which a transaction pooler cannot provide. Runtime queries use the pooled
 * URL instead — see src/lib/db/index.ts.
 */
export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
});
