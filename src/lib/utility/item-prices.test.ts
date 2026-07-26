import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The prices client is stubbed at the module boundary rather than at `fetch`.
 *
 * Never hit a live API from a test (docs/testing.md): CI runs with no secrets
 * and should not depend on the Wiki being up, and `osrsFetch` would throw on
 * `getEnv()` long before it reached the network anyway. Stubbing the client
 * also lets us assert the thing that actually matters here — that this module
 * makes exactly two bulk calls and never one per item.
 */
const fetchItemMapping = vi.fn();
const fetchLatestPrices = vi.fn();

vi.mock('@/lib/api/prices', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/api/prices')>('@/lib/api/prices');
  return {
    ...actual,
    fetchItemMapping: (...args: unknown[]) => fetchItemMapping(...args),
    fetchLatestPrices: (...args: unknown[]) => fetchLatestPrices(...args),
  };
});

vi.mock('./death-risk', async () => {
  const actual = await vi.importActual<typeof import('./death-risk')>('./death-risk');
  return {
    ...actual,
    // A tiny fixed list keeps the assertions readable and independent of edits
    // to the real curated list.
    COMMON_WILDERNESS_ITEMS: [
      'Dragon boots',
      "Karil's leathertop",
      'Renamed item',
      'Illiquid thing',
    ],
  };
});

const { fetchWildernessItemCatalogue } = await import('./item-prices');

const MAPPING = [
  { id: 1, name: 'Dragon boots', examine: '', members: true, value: 1, icon: '' },
  { id: 2, name: "Karil's leathertop", examine: '', members: true, value: 1, icon: '' },
  { id: 3, name: 'Illiquid thing', examine: '', members: true, value: 1, icon: '' },
];

beforeEach(() => {
  vi.clearAllMocks();
  fetchItemMapping.mockResolvedValue(MAPPING);
  fetchLatestPrices.mockResolvedValue({
    '1': { high: 220_000, highTime: 1, low: 200_000, lowTime: 1 },
    '2': { high: 100_000, highTime: 1, low: 90_000, lowTime: 1 },
    // One-sided: midPrice returns null rather than guessing from the high.
    '3': { high: 5_000, highTime: 1, low: null, lowTime: null },
  });
});

describe('fetchWildernessItemCatalogue', () => {
  it('prices matched items at the mid price', async () => {
    const catalogue = await fetchWildernessItemCatalogue();

    expect(catalogue.error).toBeNull();
    expect(catalogue.items).toEqual([
      { id: '1', name: 'Dragon boots', unitValue: 210_000 },
      { id: '2', name: "Karil's leathertop", unitValue: 95_000 },
    ]);
  });

  // One bulk request each, whatever the list length. The alternative — one
  // request per item — is the fan-out that gets our IP blocked (PRD §4.3).
  it('makes exactly two upstream calls regardless of list size', async () => {
    await fetchWildernessItemCatalogue();

    expect(fetchItemMapping).toHaveBeenCalledOnce();
    expect(fetchLatestPrices).toHaveBeenCalledOnce();
  });

  // A renamed item must appear as a gap, not as a 0 gp row that quietly
  // understates somebody's risk.
  it('reports a name the mapping does not know rather than pricing it at zero', async () => {
    const catalogue = await fetchWildernessItemCatalogue();

    expect(catalogue.missing).toEqual(['Renamed item']);
    expect(catalogue.items.map((item) => item.name)).not.toContain('Renamed item');
  });

  it('reports an item with only a one-sided price as unpriced', async () => {
    const catalogue = await fetchWildernessItemCatalogue();

    expect(catalogue.unpriced).toEqual(['Illiquid thing']);
  });

  // CI builds with no secrets, so getEnv() throws inside osrsFetch during
  // `next build`. Degrading is what keeps the build green and the calculator
  // usable with hand-entered values.
  it('degrades to an empty catalogue with a reason instead of throwing', async () => {
    fetchItemMapping.mockRejectedValue(new Error('Invalid environment variables:\nfoo'));

    const catalogue = await fetchWildernessItemCatalogue();

    expect(catalogue.items).toEqual([]);
    expect(catalogue.error).toContain('Live prices unavailable');
    // Only the first line — a multi-line env dump is not a UI message.
    expect(catalogue.error).not.toContain('foo');
  });
});
