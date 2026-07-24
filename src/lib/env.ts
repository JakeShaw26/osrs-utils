import 'server-only';
import { z } from 'zod';

/**
 * Validated environment access.
 *
 * WHY VALIDATION IS LAZY (this is the important part)
 *
 * The obvious implementation validates at module load:
 *
 *     export const env = serverSchema.parse(process.env);   // ✗
 *
 * That breaks `next build`. Next imports every route module during the build to
 * collect page data, which evaluates this file — in environments that
 * legitimately have no secrets: CI, a fresh clone, a Docker build stage. The
 * build then fails with "DATABASE_URL is required", which has nothing to do
 * with the code being compiled and is a confusing thing to debug.
 *
 * Validating on first *use* keeps the property that actually matters — a
 * missing secret fails loudly, naming the variable — while letting code that
 * never touches the environment compile without one.
 *
 * SECURITY: never add a NEXT_PUBLIC_* variable holding a secret. Next.js
 * inlines those into the client bundle, publishing them to every visitor.
 * `server-only` makes importing this file from a client component a build
 * error rather than a silent leak. (PRD §5.5)
 */

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Postgres. MUST be the *pooled* connection string in serverless runtimes —
  // the direct one exhausts max_connections under concurrency. (PRD §4.2)
  DATABASE_URL: z.string().url(),
  // Direct (unpooled) connection, used only by drizzle-kit for migrations.
  DATABASE_URL_UNPOOLED: z.string().url().optional(),

  // Discord OAuth — the client secret must never reach the browser.
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 characters'),
  AUTH_DISCORD_ID: z.string().min(1),
  AUTH_DISCORD_SECRET: z.string().min(1),
  DISCORD_GUILD_ID: z.string().min(1, 'The clan Discord server ID'),

  // Shared secret for scheduled-job routes. Those routes are public HTTPS URLs;
  // without this check anyone can trigger our refresh loop. (PRD §4.5)
  CRON_SECRET: z.string().min(16),

  // Optional: raises the Wise Old Man rate limit from 20 to 100 req/min.
  WOM_API_KEY: z.string().optional(),

  // Sent on every outbound OSRS Wiki request. The wiki blocks generic agents
  // and asks for contact info. Not optional in practice. (PRD §2.1)
  OSRS_API_USER_AGENT: z
    .string()
    .min(10, 'Must describe the app and include contact info'),
});

export type Env = z.infer<typeof serverSchema>;

let cached: Env | undefined;

/**
 * Returns the validated environment, parsing once and caching.
 *
 * Call this inside functions, never at module scope — module scope runs at
 * build time and reintroduces the problem this exists to solve.
 */
export function getEnv(): Env {
  if (cached) return cached;

  const parsed = serverSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(
      `Invalid environment variables:\n${issues}\n\n` +
        `Copy .env.example to .env.local and fill it in.`,
    );
  }

  cached = parsed.data;
  return cached;
}

/** Test seam: forces the next getEnv() to re-read process.env. */
export function resetEnvCache(): void {
  cached = undefined;
}
