import { describe, expect, it } from 'vitest';
import {
  DEATH_RULE_CLAUSES,
  calculateDeathRisk,
  keptItemCount,
  stackValue,
  type CarriedItem,
} from './death-risk';

function item(name: string, unitValue: number, quantity = 1): CarriedItem {
  return { id: name, name, unitValue, quantity };
}

/** Five distinct values so "which three survived" is unambiguous. */
const INVENTORY: CarriedItem[] = [
  item('Twisted bow', 1_200_000_000),
  item('Scythe of vitur', 900_000_000),
  item('Avernic defender', 60_000_000),
  item('Primordial boots', 30_000_000),
  item('Amulet of fury', 3_000_000),
];

describe('keptItemCount', () => {
  it('keeps 3 by default', () => {
    expect(keptItemCount({ skulled: false, protectItem: false })).toBe(3);
  });

  it('keeps 4 with Protect Item', () => {
    expect(keptItemCount({ skulled: false, protectItem: true })).toBe(4);
  });

  it('keeps 0 when skulled', () => {
    expect(keptItemCount({ skulled: true, protectItem: false })).toBe(0);
  });

  // The combination people get wrong: a skull does not cancel Protect Item, it
  // removes the three free slots. One item still survives.
  it('keeps 1 when skulled with Protect Item', () => {
    expect(keptItemCount({ skulled: true, protectItem: true })).toBe(1);
  });
});

describe('calculateDeathRisk', () => {
  it('protects the three most valuable items and risks the rest', () => {
    const result = calculateDeathRisk(INVENTORY, {
      skulled: false,
      protectItem: false,
    });

    expect(result.kept.map((i) => i.name)).toEqual([
      'Twisted bow',
      'Scythe of vitur',
      'Avernic defender',
    ]);
    expect(result.riskValue).toBe(30_000_000 + 3_000_000);
    expect(result.keptValue).toBe(1_200_000_000 + 900_000_000 + 60_000_000);
    expect(result.totalValue).toBe(2_193_000_000);
  });

  it('protects a fourth item with Protect Item', () => {
    const result = calculateDeathRisk(INVENTORY, {
      skulled: false,
      protectItem: true,
    });

    expect(result.kept).toHaveLength(4);
    expect(result.lost.map((i) => i.name)).toEqual(['Amulet of fury']);
    expect(result.riskValue).toBe(3_000_000);
  });

  it('risks everything when skulled', () => {
    const result = calculateDeathRisk(INVENTORY, {
      skulled: true,
      protectItem: false,
    });

    expect(result.kept).toEqual([]);
    expect(result.lost).toHaveLength(5);
    expect(result.keptValue).toBe(0);
    expect(result.riskValue).toBe(result.totalValue);
  });

  it('protects exactly one item when skulled with Protect Item', () => {
    const result = calculateDeathRisk(INVENTORY, {
      skulled: true,
      protectItem: true,
    });

    expect(result.kept.map((i) => i.name)).toEqual(['Twisted bow']);
    expect(result.riskValue).toBe(2_193_000_000 - 1_200_000_000);
  });

  // Carrying less than you are allowed to keep. `slice` past the end handles it
  // without a branch, and the risk must be zero rather than negative or NaN.
  it('risks nothing when carrying fewer items than are kept', () => {
    const result = calculateDeathRisk(INVENTORY.slice(0, 2), {
      skulled: false,
      protectItem: false,
    });

    expect(result.kept).toHaveLength(2);
    expect(result.lost).toEqual([]);
    expect(result.riskValue).toBe(0);
  });

  it('handles an empty inventory', () => {
    const result = calculateDeathRisk([], { skulled: true, protectItem: false });

    expect(result.riskValue).toBe(0);
    expect(result.totalValue).toBe(0);
    expect(result.keptCount).toBe(0);
  });

  // A stack is one protectable item however large, so a protected stack is kept
  // whole. The counterexample that would fail: splitting the stack and losing
  // the remainder.
  it('protects a whole stack as a single item', () => {
    const withStack: CarriedItem[] = [
      item('Blood rune', 400, 10_000),
      item('Bandos chestplate', 15_000_000),
      item('Bandos tassets', 25_000_000),
      item('Dragon boots', 200_000),
    ];

    const result = calculateDeathRisk(withStack, {
      skulled: false,
      protectItem: false,
    });

    // Ranked by UNIT value: the runes are the cheapest per item, so the 4m
    // stack is what gets left behind even though it beats the boots on total.
    expect(result.kept.map((i) => i.name)).toEqual([
      'Bandos tassets',
      'Bandos chestplate',
      'Dragon boots',
    ]);
    expect(result.riskValue).toBe(4_000_000);
  });

  it('values a kept stack in full', () => {
    const result = calculateDeathRisk([item('Blood rune', 400, 10_000)], {
      skulled: false,
      protectItem: false,
    });

    expect(result.keptValue).toBe(4_000_000);
    expect(result.riskValue).toBe(0);
  });

  // Callers pass React state or a cached server response. Sorting in place
  // would mutate something the function does not own — the same bug
  // `sortByRank` was written to avoid in lib/clan/ranks.ts.
  it('does not mutate the array it is given', () => {
    const input = [...INVENTORY];
    const order = input.map((i) => i.name);

    calculateDeathRisk(input, { skulled: false, protectItem: false });

    expect(input.map((i) => i.name)).toEqual(order);
  });

  it('breaks value ties by input order, so the result is stable', () => {
    const tied = [item('A', 1_000), item('B', 1_000), item('C', 1_000), item('D', 500)];

    const first = calculateDeathRisk(tied, { skulled: false, protectItem: false });
    const second = calculateDeathRisk(tied, { skulled: false, protectItem: false });

    expect(first.kept.map((i) => i.name)).toEqual(['A', 'B', 'C']);
    expect(second.kept.map((i) => i.name)).toEqual(first.kept.map((i) => i.name));
  });
});

describe('stackValue', () => {
  it('multiplies unit value by quantity', () => {
    expect(stackValue(item('Shark', 800, 20))).toBe(16_000);
  });
});

describe('rule provenance', () => {
  // The dataset is the product here as much as the maths is: an unsourced rule
  // cannot be audited when Jagex next changes the wilderness.
  it('states a source for every clause', () => {
    for (const clause of DEATH_RULE_CLAUSES) {
      expect(clause.source.length).toBeGreaterThan(0);
      expect(['documented', 'community', 'unverified']).toContain(clause.confidence);
    }
  });
});
