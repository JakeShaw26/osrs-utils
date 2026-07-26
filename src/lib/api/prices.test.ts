import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetEnvCache } from '@/lib/env';
import { OsrsApiError } from './osrs-fetch';
import {
  fetchAveragePrices,
  fetchItemMapping,
  fetchLatestPrice,
  fetchLatestPrices,
  fetchTimeseries,
  indexMappingById,
  indexMappingByName,
  midPrice,
  timestepForDays,
  type ItemMapping,
} from './prices';

/**
 * The network functions are tested through a stubbed `fetch` because what can
 * actually break is the request we build — the URL, the query string and the
 * cache TTL — not the JSON parsing. Hitting the live API in CI would also
 * violate the self-limiting rule in docs/api-terms.md.
 */

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

/** Narrow the stub's recorded call to the bits we assert on. */
function lastRequest(stub: ReturnType<typeof vi.fn>) {
  const [url, init] = stub.mock.calls.at(-1) as [
    string,
    RequestInit & { next?: unknown },
  ];
  return { url: new URL(url), init };
}

describe('prices client', () => {
  const fetchStub = vi.fn();

  beforeEach(() => {
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/db';
    process.env.WOM_GROUP_ID = '25092';
    process.env.CRON_SECRET = 'test-cron-secret-value';
    process.env.OSRS_API_USER_AGENT = 'osrs-clan-toolkit test (+contact)';
    resetEnvCache();

    fetchStub.mockReset();
    vi.stubGlobal('fetch', fetchStub);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('unwraps the data envelope on /latest', async () => {
    fetchStub.mockResolvedValue(
      jsonResponse({ data: { '20997': { high: 5, highTime: 1, low: 4, lowTime: 2 } } }),
    );

    await expect(fetchLatestPrices()).resolves.toEqual({
      '20997': { high: 5, highTime: 1, low: 4, lowTime: 2 },
    });

    expect(lastRequest(fetchStub).url.pathname).toBe('/api/v1/osrs/latest');
  });

  it('sends the mandatory User-Agent', async () => {
    // Forgetting this does not fail in development — it gets our IP blocked in
    // production. That is why it is asserted rather than assumed.
    fetchStub.mockResolvedValue(jsonResponse({ data: {} }));
    await fetchLatestPrices();

    const headers = lastRequest(fetchStub).init.headers as Record<string, string>;
    expect(headers['User-Agent']).toContain('osrs-clan-toolkit');
  });

  it('serves a single item from the bulk response, not a per-item URL', async () => {
    // A per-item URL is a per-item cache entry, which makes outbound traffic
    // scale with what visitors search for. See the module comment.
    fetchStub.mockResolvedValue(
      jsonResponse({ data: { '20997': { high: 5, highTime: 1, low: 4, lowTime: 2 } } }),
    );

    await expect(fetchLatestPrice(20997)).resolves.toEqual({
      high: 5,
      highTime: 1,
      low: 4,
      lowTime: 2,
    });

    expect(lastRequest(fetchStub).url.searchParams.get('id')).toBeNull();
  });

  it('returns null for an item with no price data', async () => {
    fetchStub.mockResolvedValue(jsonResponse({ data: {} }));

    await expect(fetchLatestPrice(999999)).resolves.toBeNull();
  });

  it('caches the item mapping for a day rather than a minute', async () => {
    // ~850 KB that changes on weekly game updates. At the default 60s prices
    // TTL we would re-download it every minute for nothing.
    fetchStub.mockResolvedValue(jsonResponse([]));
    await fetchItemMapping();

    expect(lastRequest(fetchStub).init.next).toEqual({ revalidate: 86_400 });
  });

  it('requests a timeseries by id and timestep', async () => {
    fetchStub.mockResolvedValue(jsonResponse({ data: [] }));
    await fetchTimeseries(20997, '6h');

    const { url } = lastRequest(fetchStub);
    expect(url.pathname).toBe('/api/v1/osrs/timeseries');
    expect(url.searchParams.get('id')).toBe('20997');
    expect(url.searchParams.get('timestep')).toBe('6h');
  });

  it('omits the timestamp parameter when asking for the live block', async () => {
    // An empty `timestamp=` is a different URL, so it would fragment the cache.
    fetchStub.mockResolvedValue(jsonResponse({ data: {} }));
    await fetchAveragePrices('1h');

    expect(lastRequest(fetchStub).url.searchParams.has('timestamp')).toBe(false);
  });

  it('caches a historical block for a day — past blocks never change', async () => {
    fetchStub.mockResolvedValue(jsonResponse({ data: {} }));
    await fetchAveragePrices('1h', 1_784_912_400);

    expect(lastRequest(fetchStub).init.next).toEqual({ revalidate: 86_400 });
  });

  it('throws a typed error naming the source and status', async () => {
    fetchStub.mockResolvedValue(new Response('nope', { status: 503 }));

    await expect(fetchLatestPrices()).rejects.toBeInstanceOf(OsrsApiError);
  });
});

describe('timestepForDays', () => {
  it('picks the finest granularity that still covers the range', () => {
    expect(timestepForDays(1)).toBe('5m');
    expect(timestepForDays(7)).toBe('1h');
    expect(timestepForDays(30)).toBe('6h');
    expect(timestepForDays(180)).toBe('24h');
  });

  it('does not overrun a timestep at its exact span', () => {
    // 15.3 days is 1h's ceiling at 365 points; one day more must step down to
    // 6h or the chart silently truncates.
    expect(timestepForDays(15.3)).toBe('1h');
    expect(timestepForDays(16)).toBe('6h');
  });

  it('clamps beyond the ceiling instead of throwing', () => {
    // ~1 year is the limit of the data itself (ADR-0003). A caller asking for
    // five years cannot fix that, so give them the longest range there is.
    expect(timestepForDays(5000)).toBe('24h');
  });
});

describe('midPrice', () => {
  it('averages the two sides, truncating down', () => {
    // Truncating keeps us consistent with formatGp: never overstate money.
    expect(midPrice({ high: 100, highTime: 1, low: 99, lowTime: 1 })).toBe(99);
  });

  it('is null when either side is missing', () => {
    // Falling back to the one side we have produces a confidently wrong number
    // on exactly the illiquid items where a player is most likely to trust it.
    expect(midPrice({ high: 100, highTime: 1, low: null, lowTime: null })).toBeNull();
    expect(midPrice({ high: null, highTime: null, low: 99, lowTime: 1 })).toBeNull();
    expect(midPrice(null)).toBeNull();
  });
});

describe('mapping indexes', () => {
  const mapping: ItemMapping[] = [
    {
      id: 1127,
      name: 'Rune platebody',
      examine: '',
      members: false,
      value: 39000,
      icon: 'x.png',
    },
    {
      id: 20997,
      name: 'Twisted bow',
      examine: '',
      members: true,
      value: 1,
      icon: 'y.png',
    },
  ];

  it('looks up by name case-insensitively', () => {
    const byName = indexMappingByName(mapping);

    expect(byName.get('twisted bow')?.id).toBe(20997);
    expect(byName.get('TWISTED BOW'.toLowerCase())?.id).toBe(20997);
  });

  it('looks up by numeric id', () => {
    expect(indexMappingById(mapping).get(1127)?.name).toBe('Rune platebody');
  });
});
