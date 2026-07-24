import 'server-only';
import { getEnv } from '@/lib/env';

/**
 * The ONLY place outbound requests to OSRS data sources are made.
 *
 * Why a chokepoint rather than calling fetch() per feature:
 *
 *  1. The OSRS Wiki blocks default user agents and asks that automated clients
 *     identify themselves with contact info. Forgetting the header does not
 *     fail in development — it gets us blocked in production, later, for
 *     everyone. Centralising makes it impossible to forget. (PRD §2.1)
 *
 *  2. The Jagex hiscores send no Access-Control-Allow-Origin header (verified),
 *     so these calls are physically impossible from a browser. `server-only`
 *     turns a mistaken client import into a build error rather than a runtime
 *     one. (PRD §2.4)
 *
 *  3. Cache TTLs belong next to the source they protect. Our rate-limit
 *     headroom with the Wiki is goodwill, not contract. (PRD §4.3)
 */

const BASES = {
  prices: 'https://prices.runescape.wiki/api/v1/osrs',
  wiki: 'https://oldschool.runescape.wiki/api.php',
  hiscores: 'https://secure.runescape.com/m=hiscore_oldschool',
  wom: 'https://api.wiseoldman.net/v2',
} as const;

export type OsrsSource = keyof typeof BASES;

/** Defaults from PRD §4.3. Override per call only with a reason. */
const DEFAULT_REVALIDATE: Record<OsrsSource, number> = {
  prices: 60,
  wiki: 86_400, // near-static; changes on weekly game updates
  hiscores: 300,
  wom: 600,
};

export class OsrsApiError extends Error {
  constructor(
    readonly source: OsrsSource,
    readonly status: number,
    readonly url: string,
  ) {
    super(`${source} request failed (${status}): ${url}`);
    this.name = 'OsrsApiError';
  }
}

interface RequestOptions {
  /** Cache lifetime in seconds. Defaults per source. */
  revalidate?: number;
  searchParams?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
}

function buildUrl(
  source: OsrsSource,
  path: string,
  searchParams?: RequestOptions['searchParams'],
): string {
  const url = new URL(path ? `${BASES[source]}${path}` : BASES[source]);
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export async function osrsFetch<T>(
  source: OsrsSource,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const url = buildUrl(source, path, options.searchParams);
  const env = getEnv();

  const headers: Record<string, string> = {
    // Mandatory. See note 1 above.
    'User-Agent': env.OSRS_API_USER_AGENT,
    Accept: 'application/json',
  };

  // Raises the WOM limit from 20 to 100 req/min when configured.
  if (source === 'wom' && env.WOM_API_KEY) {
    headers['x-api-key'] = env.WOM_API_KEY;
  }

  const response = await fetch(url, {
    headers,
    signal: options.signal,
    next: { revalidate: options.revalidate ?? DEFAULT_REVALIDATE[source] },
  });

  if (!response.ok) {
    throw new OsrsApiError(source, response.status, url);
  }

  return (await response.json()) as T;
}

/**
 * Guard against the failure mode most likely to get us rate-limited: a page
 * that loops over clan members and issues one upstream request each. At 500
 * members and WOM's 20 req/min that is a ~25-minute page load.
 *
 * Leaderboards must read pre-aggregated rows. Call this in any code path that
 * could iterate members, so the mistake surfaces in development. (PRD §4.3)
 */
export function assertNoFanOut(itemCount: number, context: string): void {
  const LIMIT = 5;
  if (itemCount > LIMIT) {
    throw new Error(
      `Refusing to fan out ${itemCount} upstream requests in "${context}". ` +
        `Read pre-aggregated data instead, or batch this into a scheduled job. ` +
        `See PRD §4.3.`,
    );
  }
}
