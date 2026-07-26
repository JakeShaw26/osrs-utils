import { describe, expect, it } from 'vitest';
import {
  compareMethods,
  methodsForSkill,
  requiredItemNames,
  sortComparedMethods,
  trainableSkills,
  TRAINING_METHODS,
} from './training-methods';
import type { ItemPrices, TrainingMethod } from './types';

const SOURCE = {
  title: 'Test',
  url: 'https://oldschool.runescape.wiki/w/Test',
  retrieved: '2026-07-26',
  basis: 'wiki-guide' as const,
};

function method(overrides: Partial<TrainingMethod> = {}): TrainingMethod {
  return {
    id: 'test-method',
    skill: 'Fletching',
    name: 'Test method',
    minLevel: 50,
    xpPerAction: 100,
    xpPerHour: 200_000,
    inputs: [{ item: 'Widget', quantity: 1 }],
    outputs: [],
    source: SOURCE,
    ...overrides,
  };
}

const PRICES: ItemPrices = { widget: 500, gadget: 900, 'no price thing': null };

describe('compareMethods', () => {
  it('computes gp/xp, actions, hours and total gp for a goal', () => {
    const [row] = compareMethods([method()], { prices: PRICES, xpRemaining: 1_000_000 });

    expect(row!.gpPerXp).toBe(5); // 500 gp for 100 xp
    expect(row!.actions).toBe(10_000);
    expect(row!.hours).toBe(5); // 1,000,000 / 200,000
    expect(row!.totalGp).toBe(5_000_000);
  });

  it('rounds the action count up', () => {
    const [row] = compareMethods([method({ xpPerAction: 300 })], {
      prices: PRICES,
      xpRemaining: 1000,
    });

    expect(row!.actions).toBe(4); // 3.33 -> 4
  });

  /**
   * The whole point of the comparator (PRD §3.3): a member who disagrees with a
   * rate changes it and gets their own answer, instead of filing a bug report.
   */
  it('uses a user override in place of the authored xp/hr', () => {
    const [row] = compareMethods([method()], {
      prices: PRICES,
      xpRemaining: 1_000_000,
      xpPerHourOverrides: { 'test-method': 500_000 },
    });

    expect(row!.xpPerHour).toBe(500_000);
    expect(row!.overridden).toBe(true);
    expect(row!.hours).toBe(2);
  });

  it('ignores a zero, negative or non-numeric override', () => {
    for (const bad of [0, -100, Number.NaN]) {
      const [row] = compareMethods([method()], {
        prices: PRICES,
        xpRemaining: 1_000_000,
        xpPerHourOverrides: { 'test-method': bad },
      });

      expect(row!.xpPerHour).toBe(200_000);
      expect(row!.overridden).toBe(false);
    }
  });

  it('does not mark an override that equals the authored rate as edited', () => {
    const [row] = compareMethods([method()], {
      prices: PRICES,
      xpRemaining: 1_000_000,
      xpPerHourOverrides: { 'test-method': 200_000 },
    });

    expect(row!.overridden).toBe(false);
  });

  it("marks a method above the player's level as locked without hiding it", () => {
    const [row] = compareMethods([method({ minLevel: 80 })], {
      prices: PRICES,
      xpRemaining: 1000,
      currentLevel: 70,
    });

    expect(row!.locked).toBe(true);
    // Still costed — levels are boostable, so it is advisory.
    expect(row!.gpPerXp).toBe(5);
  });

  it('leaves everything unlocked when no current level is supplied', () => {
    const [row] = compareMethods([method({ minLevel: 80 })], {
      prices: PRICES,
      xpRemaining: 1000,
    });

    expect(row!.locked).toBe(false);
  });

  /* --- The price edge cases the brief calls out ---------------------------- */

  it('reports gp/xp as null and names the item when a price is missing', () => {
    const [row] = compareMethods(
      [method({ inputs: [{ item: 'No price thing', quantity: 1 }] })],
      {
        prices: PRICES,
        xpRemaining: 1_000_000,
      },
    );

    expect(row!.gpPerXp).toBeNull();
    expect(row!.totalGp).toBeNull();
    expect(row!.unpricedItems).toEqual(['No price thing']);
    // The rate half of the answer still works — an absent price must not blank
    // out the figures that do not depend on it.
    expect(row!.actions).toBe(10_000);
    expect(row!.hours).toBe(5);
  });

  it('reports gp/xp as null for an item that is not in the price map at all', () => {
    const [row] = compareMethods(
      [method({ inputs: [{ item: 'Unknown', quantity: 1 }] })],
      {
        prices: PRICES,
        xpRemaining: 1000,
      },
    );

    expect(row!.gpPerXp).toBeNull();
    expect(row!.unpricedItems).toEqual(['Unknown']);
  });

  // Zero is a price, not a gap. gp/xp of 0 is the correct answer here.
  it('reports gp/xp as zero — not null — when an input price is zero', () => {
    const [row] = compareMethods([method()], {
      prices: { widget: 0 },
      xpRemaining: 1_000_000,
    });

    expect(row!.gpPerXp).toBe(0);
    expect(row!.totalGp).toBe(0);
    expect(row!.unpricedItems).toEqual([]);
  });

  it('reports a negative gp/xp for a method that makes money', () => {
    const [row] = compareMethods(
      [method({ outputs: [{ item: 'Gadget', quantity: 1 }] })],
      { prices: PRICES, xpRemaining: 1_000_000 },
    );

    expect(row!.gpPerXp).toBe(-4); // 500 spent, 900 recovered, over 100 xp
    expect(row!.totalGp).toBe(-4_000_000);
  });

  it('costs a fractional input quantity, as the Chaos Altar bone save needs', () => {
    const [row] = compareMethods(
      [method({ inputs: [{ item: 'Widget', quantity: 0.5 }] })],
      {
        prices: PRICES,
        xpRemaining: 1000,
      },
    );

    expect(row!.gpPerXp).toBe(2.5);
  });

  it('produces zero totals for a goal that is already met', () => {
    const [row] = compareMethods([method()], { prices: PRICES, xpRemaining: 0 });

    expect(row!.actions).toBe(0);
    expect(row!.hours).toBe(0);
    expect(row!.totalGp).toBe(0);
  });
});

describe('sortComparedMethods', () => {
  const rows = compareMethods(
    [
      method({ id: 'cheap-slow', xpPerHour: 100_000, minLevel: 90, inputs: [] }),
      method({ id: 'dear-fast', xpPerHour: 900_000, minLevel: 10 }),
      method({
        id: 'unknown-cost',
        xpPerHour: 500_000,
        minLevel: 50,
        inputs: [{ item: 'Unknown', quantity: 1 }],
      }),
    ],
    { prices: PRICES, xpRemaining: 1_000_000 },
  );

  it('sorts fastest by descending xp/hr', () => {
    expect(sortComparedMethods(rows, 'fastest').map((row) => row.method.id)).toEqual([
      'dear-fast',
      'unknown-cost',
      'cheap-slow',
    ]);
  });

  it('sorts by level requirement ascending', () => {
    expect(sortComparedMethods(rows, 'level').map((row) => row.method.id)).toEqual([
      'dear-fast',
      'unknown-cost',
      'cheap-slow',
    ]);
  });

  /**
   * Unknown cost sorts LAST, not first. `null` compared numerically coerces to
   * 0, which would rank "we have no idea what this costs" as free — the most
   * misleading possible answer to "what is cheapest".
   */
  it('sorts unknown costs last under cheapest, not first', () => {
    const sorted = sortComparedMethods(rows, 'cheapest');

    expect(sorted[0]!.method.id).toBe('cheap-slow'); // free
    expect(sorted[2]!.method.id).toBe('unknown-cost');
  });

  /**
   * Copies before sorting. The method list is a module-level constant shared by
   * every request in a warm serverless instance; sorting it in place is a bug
   * that only appears under concurrency — the same trap `sortByRank` documents.
   */
  it('does not mutate the array it was given', () => {
    const before = rows.map((row) => row.method.id);
    sortComparedMethods(rows, 'fastest');

    expect(rows.map((row) => row.method.id)).toEqual(before);
  });
});

describe('the shipped method data', () => {
  it('exposes at least one skill and one method per skill', () => {
    const skills = trainableSkills();

    expect(skills.length).toBeGreaterThan(0);
    for (const skill of skills) {
      expect(methodsForSkill(skill).length, skill).toBeGreaterThan(0);
    }
  });

  it('lists every item name exactly once', () => {
    const names = requiredItemNames();

    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain('Dragon bones');
  });

  it('costs every shipped method without throwing when prices are entirely absent', () => {
    const rows = compareMethods(TRAINING_METHODS, { prices: {}, xpRemaining: 1_000_000 });

    for (const row of rows) {
      expect(row.hours).not.toBeNull();
      expect(row.actions).not.toBeNull();
      // Methods with no inputs and no outputs are legitimately free.
      if (row.method.inputs.length > 0) expect(row.gpPerXp).toBeNull();
    }
  });
});
