import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetEnvCache } from '@/lib/env';
import { fetchPricesForItems, unpricedNames } from './pricing';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const MAPPING = [
  { id: 536, name: 'Dragon bones', examine: '', members: true, value: 1, icon: '' },
  { id: 1515, name: 'Yew logs', examine: '', members: false, value: 1, icon: '' },
  { id: 1777, name: 'Bow string', examine: '', members: false, value: 1, icon: '' },
];

describe('fetchPricesForItems', () => {
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
    vi.restoreAllMocks();
  });

  function respondWith(latest: Record<string, unknown>) {
    fetchStub.mockImplementation((url: string) =>
      Promise.resolve(
        url.includes('/mapping') ? jsonResponse(MAPPING) : jsonResponse({ data: latest }),
      ),
    );
  }

  it('resolves names to the mid price, keyed by lowercased name', async () => {
    respondWith({ '536': { high: 2600, highTime: 1, low: 2400, lowTime: 2 } });

    const lookup = await fetchPricesForItems(['Dragon bones']);

    expect(lookup.prices).toEqual({ 'dragon bones': 2500 });
    expect(lookup.unavailable).toBe(false);
  });

  it('matches names case-insensitively', async () => {
    respondWith({ '536': { high: 2600, highTime: 1, low: 2400, lowTime: 2 } });

    const lookup = await fetchPricesForItems(['DRAGON BONES']);

    expect(lookup.prices['dragon bones']).toBe(2500);
  });

  /**
   * NO FAN-OUT (hard rule #4). Both endpoints are bulk, so thirty item names
   * cost the same two upstream requests as one — and the same two cache entries
   * serve every visitor. A loop over `fetchLatestPrice` here would be the exact
   * failure `assertNoFanOut` exists to catch.
   */
  it('makes exactly two upstream requests regardless of how many items are asked for', async () => {
    respondWith({
      '536': { high: 2600, highTime: 1, low: 2400, lowTime: 2 },
      '1515': { high: 300, highTime: 1, low: 280, lowTime: 2 },
      '1777': { high: 120, highTime: 1, low: 100, lowTime: 2 },
    });

    await fetchPricesForItems(['Dragon bones', 'Yew logs', 'Bow string']);

    expect(fetchStub).toHaveBeenCalledTimes(2);
  });

  it('returns null for a name the mapping does not contain', async () => {
    respondWith({});

    const lookup = await fetchPricesForItems(['Dragon bones', 'Typo bones']);

    expect(lookup.prices['typo bones']).toBeNull();
  });

  /**
   * `midPrice` returns null when only one side of the book has a price. A
   * one-sided price is not a market value, and substituting it produces
   * confidently wrong numbers on exactly the thin items a player would be most
   * misled about.
   */
  it('returns null when the item has only a one-sided price', async () => {
    respondWith({ '536': { high: 2600, highTime: 1, low: null, lowTime: null } });

    const lookup = await fetchPricesForItems(['Dragon bones']);

    expect(lookup.prices['dragon bones']).toBeNull();
  });

  /**
   * NEVER THROWS. This runs inside a page render, and the whole feature is
   * designed to degrade to "type your own prices" rather than to an error page.
   */
  it('reports unavailable instead of throwing when the upstream fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchStub.mockResolvedValue(new Response('', { status: 503 }));

    const lookup = await fetchPricesForItems(['Dragon bones']);

    expect(lookup.unavailable).toBe(true);
    // Every requested name is still present, so a caller can render a full
    // table with blank prices rather than an empty one.
    expect(lookup.prices).toEqual({ 'dragon bones': null });
  });

  it('reports unavailable when the network itself fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchStub.mockRejectedValue(new Error('ECONNRESET'));

    const lookup = await fetchPricesForItems(['Dragon bones', 'Yew logs']);

    expect(lookup.unavailable).toBe(true);
    expect(Object.keys(lookup.prices)).toEqual(['dragon bones', 'yew logs']);
  });

  it('handles an empty request list without calling the upstream twice for nothing', async () => {
    respondWith({});

    const lookup = await fetchPricesForItems([]);

    expect(lookup.prices).toEqual({});
    expect(lookup.unavailable).toBe(false);
  });
});

describe('unpricedNames', () => {
  it('lists only the names with no price', () => {
    expect(
      unpricedNames({ prices: { a: 1, b: null, c: 0 }, unavailable: false }),
    ).toEqual(['b']);
  });
});
