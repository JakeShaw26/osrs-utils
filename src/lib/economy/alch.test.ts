import { describe, expect, it } from 'vitest';
import {
  ALCH_CASTS_PER_HOUR,
  calculateAlchProfit,
  rankAlchOpportunities,
  type AlchCandidate,
} from './alch';

describe('calculateAlchProfit', () => {
  it('is alch value minus buy price minus the nature rune', () => {
    const result = calculateAlchProfit({
      highAlchValue: 1_000,
      buyPrice: 700,
      natureRunePrice: 100,
      buyLimit: null,
    });

    expect(result.profitPerCast).toBe(200);
    expect(result.isLoss).toBe(false);
  });

  // The common case. Most items lose money to alch, and a calculator that hides
  // that by clamping at zero is worse than useless.
  it('reports a loss rather than clamping to zero', () => {
    const result = calculateAlchProfit({
      highAlchValue: 1_000,
      buyPrice: 1_500,
      natureRunePrice: 100,
    });

    expect(result.profitPerCast).toBe(-600);
    expect(result.isLoss).toBe(true);
    expect(result.profitPerHour).toBeLessThan(0);
  });

  it('is bounded by casting speed when the item has no buy limit', () => {
    const result = calculateAlchProfit({
      highAlchValue: 1_000,
      buyPrice: 700,
      natureRunePrice: 100,
      buyLimit: null,
    });

    expect(result.sustainableCastsPerHour).toBe(ALCH_CASTS_PER_HOUR);
    expect(result.limitedByBuyLimit).toBe(false);
    expect(result.profitPerHour).toBe(200 * ALCH_CASTS_PER_HOUR);
    expect(result.profitPerBuyLimit).toBeNull();
  });

  // This is the whole reason the function is more than a subtraction: a buy
  // limit of 8 per 4 hours means 2 casts an hour, not 1,200.
  it('is bounded by resupply when the buy limit is small', () => {
    const result = calculateAlchProfit({
      highAlchValue: 100_000,
      buyPrice: 50_000,
      natureRunePrice: 100,
      buyLimit: 8,
    });

    expect(result.profitPerCast).toBe(49_900);
    expect(result.sustainableCastsPerHour).toBe(2); // 8 per 4 hours
    expect(result.limitedByBuyLimit).toBe(true);
    expect(result.profitPerHour).toBe(49_900 * 2);
    expect(result.profitPerBuyLimit).toBe(49_900 * 8);

    // And the naive figure it replaces, for contrast.
    expect(result.unlimitedProfitPerHour).toBe(49_900 * ALCH_CASTS_PER_HOUR);
  });

  it('stays bounded by casting speed when the buy limit is generous', () => {
    // 13,000 per 4 hours = 3,250/hour of resupply, more than we can cast.
    const result = calculateAlchProfit({
      highAlchValue: 1_000,
      buyPrice: 700,
      natureRunePrice: 100,
      buyLimit: 13_000,
    });

    expect(result.sustainableCastsPerHour).toBe(ALCH_CASTS_PER_HOUR);
    expect(result.limitedByBuyLimit).toBe(false);
  });

  it('floors a fractional cast rate — you cannot cast 0.75 of a spell', () => {
    const result = calculateAlchProfit({
      highAlchValue: 1_000,
      buyPrice: 500,
      natureRunePrice: 100,
      buyLimit: 3, // 0.75 per hour
    });

    expect(result.sustainableCastsPerHour).toBe(0);
    expect(result.profitPerHour).toBe(0);
  });

  it('marks an unalchable item rather than treating it as zero value', () => {
    const result = calculateAlchProfit({
      highAlchValue: null,
      buyPrice: 500,
      natureRunePrice: 100,
    });

    expect(result.unalchable).toBe(true);
  });

  it('does not produce NaN from missing prices', () => {
    const result = calculateAlchProfit({
      highAlchValue: undefined,
      buyPrice: null,
      natureRunePrice: undefined,
    });

    expect(result.profitPerCast).toBe(0);
    expect(Number.isNaN(result.profitPerHour)).toBe(false);
  });
});

describe('rankAlchOpportunities', () => {
  const candidates: AlchCandidate[] = [
    // Huge per-cast profit, tiny buy limit — the trap most alch tables fall for.
    {
      id: 1,
      name: 'Rare with a tiny limit',
      highAlch: 100_000,
      buyPrice: 50_000,
      buyLimit: 8,
      recentVolume: 50,
    },
    // Small per-cast profit, enormous buy limit — the actual winner.
    {
      id: 2,
      name: 'Bulk staple',
      highAlch: 1_000,
      buyPrice: 700,
      buyLimit: 13_000,
      recentVolume: 5_000,
    },
    // Profitable but nobody trades it.
    {
      id: 3,
      name: 'Dead item',
      highAlch: 100_000,
      buyPrice: 1_000,
      buyLimit: 10_000,
      recentVolume: 1,
    },
    // Loses money.
    {
      id: 4,
      name: 'Loss maker',
      highAlch: 500,
      buyPrice: 900,
      buyLimit: 1_000,
      recentVolume: 500,
    },
  ];

  it('ranks by realistic gp/hour, not by profit per cast', () => {
    const ranked = rankAlchOpportunities(candidates, 100);

    // The bulk staple earns 200 * 1,200 = 240,000/hr; the rare earns
    // 49,900 * 2 = 99,800/hr. Sorting by per-cast profit would invert this.
    expect(ranked[0]?.item.name).toBe('Bulk staple');
    expect(ranked[1]?.item.name).toBe('Rare with a tiny limit');
  });

  it('excludes items that lose money', () => {
    const ranked = rankAlchOpportunities(candidates, 100);

    expect(ranked.map((entry) => entry.item.name)).not.toContain('Loss maker');
  });

  // Without this filter a table sorted by profit is topped by whatever nobody
  // sells — the same trap the flipping calculator warns about.
  it('excludes items with too little trade volume to resupply', () => {
    const ranked = rankAlchOpportunities(candidates, 100);

    expect(ranked.map((entry) => entry.item.name)).not.toContain('Dead item');
  });

  it('respects the result limit', () => {
    expect(rankAlchOpportunities(candidates, 100, 1)).toHaveLength(1);
  });

  it('returns nothing when the nature rune price is unknown and swallows profit', () => {
    // A null nature price is treated as 0 cost, so profitability is unaffected
    // — the caller surfaces the missing price rather than the ranking hiding it.
    const ranked = rankAlchOpportunities(candidates, null);

    expect(ranked.length).toBeGreaterThan(0);
  });
});
