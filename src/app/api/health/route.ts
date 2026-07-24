import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';

/**
 * Health check — the only endpoint in this scaffold.
 *
 * Verifies the process is up AND that it can reach Postgres, because "the app
 * responds" and "the app works" are different claims and only the second is
 * useful in an incident.
 *
 * Deliberately unauthenticated, and deliberately leaks nothing beyond up/down:
 * error details go to the log, not the response body.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const startedAt = Date.now();

  try {
    await getDb().execute(sql`select 1`);
  } catch (error) {
    console.error('[health] database check failed', error);
    return NextResponse.json(
      { status: 'error', database: 'unreachable' },
      { status: 503 },
    );
  }

  return NextResponse.json({
    status: 'ok',
    database: 'ok',
    latencyMs: Date.now() - startedAt,
  });
}
