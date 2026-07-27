import { describe, expect, it } from 'vitest';
import { costBreakdown, gpPerXp, totalCost, totalGpForXp, unitPrice } from './costing';
import type { ItemPrices } from './types';

const PRICES: ItemPrices = {
  'dragon bones': 2500,
  'bow string': 100,
  'yew longbow (u)': 200,
  'yew longbow': 400,
  'free thing': 0,
  'untradeable thing': null,
};

describe('unitPrice', () => {
  it('matches case-insensitively, because authored data is title-cased', () => {
    expect(unitPrice(PRICES, 'Dragon bones')).toBe(2500);
    expect(unitPrice(PRICES, 'DRAGON BONES')).toBe(2500);
  });

  it('returns null for an item that is absent and one that has no price', () => {
    expect(unitPrice(PRICES, 'Nonexistent item')).toBeNull();
    expect(unitPrice(PRICES, 'Untradeable thing')).toBeNull();
  });

  /**
   * A price of 0 is a real market value, not a missing one. Conflating the two
   * would blank out an entire costing over one worthless ingredient.
   */
  it('treats a price of zero as a price, not as missing', () => {
    expect(unitPrice(PRICES, 'Free thing')).toBe(0);
  });
});

describe('totalCost', () => {
  it('multiplies quantity by unit price', () => {
    const result = totalCost([{ item: 'Dragon bones', quantity: 3 }], PRICES);

    expect(result.total).toBe(7500);
    expect(result.unpriced).toEqual([]);
  });

  it('handles the fractional quantities the Chaos Altar bone-save needs', () => {
    const result = totalCost([{ item: 'Dragon bones', quantity: 0.5 }], PRICES);

    expect(result.total).toBe(1250);
  });

  /**
   * Null, not a partial sum. A total that silently omits an ingredient looks
   * like a bargain, and the unpriced items are exactly the ones a player is
   * most likely to be misled about.
   */
  it('returns null — never a partial total — when any price is missing', () => {
    const result = totalCost(
      [
        { item: 'Dragon bones', quantity: 1 },
        { item: 'Untradeable thing', quantity: 1 },
      ],
      PRICES,
    );

    expect(result.total).toBeNull();
    expect(result.unpriced).toEqual(['Untradeable thing']);
  });

  it('names every unpriced item, not just the first', () => {
    const result = totalCost(
      [
        { item: 'Untradeable thing', quantity: 1 },
        { item: 'Nonexistent item', quantity: 1 },
      ],
      PRICES,
    );

    expect(result.unpriced).toEqual(['Untradeable thing', 'Nonexistent item']);
  });

  it('is zero for an empty list', () => {
    expect(totalCost([], PRICES).total).toBe(0);
  });

  it('is zero when everything is free, rather than null', () => {
    expect(totalCost([{ item: 'Free thing', quantity: 10 }], PRICES).total).toBe(0);
  });
});

describe('costBreakdown', () => {
  it('nets outputs off inputs', () => {
    const result = costBreakdown(
      [
        { item: 'Yew longbow (u)', quantity: 1 },
        { item: 'Bow string', quantity: 1 },
      ],
      [{ item: 'Yew longbow', quantity: 1 }],
      PRICES,
    );

    expect(result.inputCost).toBe(300);
    expect(result.outputValue).toBe(400);
    expect(result.netCost).toBe(-100);
  });

  // A negative net cost is the most useful fact about a profitable method.
  it('produces a negative net cost when the method makes money', () => {
    const result = costBreakdown(
      [{ item: 'Bow string', quantity: 1 }],
      [{ item: 'Yew longbow', quantity: 1 }],
      PRICES,
    );

    expect(result.netCost).toBeLessThan(0);
  });

  it('is null overall when an output price is missing', () => {
    const result = costBreakdown(
      [{ item: 'Bow string', quantity: 1 }],
      [{ item: 'Untradeable thing', quantity: 1 }],
      PRICES,
    );

    expect(result.netCost).toBeNull();
    expect(result.unpricedItems).toEqual(['Untradeable thing']);
  });
});

describe('gpPerXp', () => {
  it('divides net cost by XP per action', () => {
    expect(gpPerXp(2500, 250)).toBe(10);
  });

  it('is negative for a profitable method rather than clamped to zero', () => {
    expect(gpPerXp(-100, 50)).toBe(-2);
  });

  it('is zero when the method is free', () => {
    expect(gpPerXp(0, 250)).toBe(0);
  });

  it('is null when the cost is unknown', () => {
    expect(gpPerXp(null, 250)).toBeNull();
  });

  // Division by zero yields Infinity, which renders on screen as "Infinity".
  it('is null for a zero or negative XP rate rather than Infinity', () => {
    expect(gpPerXp(2500, 0)).toBeNull();
    expect(gpPerXp(2500, -1)).toBeNull();
    expect(gpPerXp(2500, Number.NaN)).toBeNull();
  });
});

describe('totalGpForXp', () => {
  it('scales gp/xp by the XP remaining', () => {
    expect(totalGpForXp(10, 1_000_000)).toBe(10_000_000);
  });

  it('is zero when nothing is left, and null when the rate is unknown', () => {
    expect(totalGpForXp(10, 0)).toBe(0);
    expect(totalGpForXp(null, 1_000_000)).toBeNull();
  });
});
