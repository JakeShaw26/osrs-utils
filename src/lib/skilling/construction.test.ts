import { describe, expect, it } from 'vitest';
import {
  buildsAtLevel,
  CONSTRUCTION_BUILDS,
  constructionItemNames,
  planConstruction,
} from './construction';
import type { ConstructionBuild, ItemPrices } from './types';

const OAK_LARDER: ConstructionBuild = {
  id: 'oak-larder',
  name: 'Oak larder',
  room: 'Kitchen',
  minLevel: 33,
  xpPerBuild: 480,
  materials: [{ item: 'Oak plank', quantity: 8 }],
  xpPerHour: 480_000,
};

const PRICES: ItemPrices = { 'oak plank': 500, 'steel nails': 10, 'mystery plank': null };

describe('planConstruction', () => {
  it('turns an XP goal into a priced shopping list', () => {
    const plan = planConstruction(OAK_LARDER, 480_000, PRICES);

    expect(plan.builds).toBe(1000);
    expect(plan.hours).toBe(1);
    expect(plan.materials[0]!.totalQuantity).toBe(8000);
    expect(plan.materials[0]!.lineCost).toBe(4_000_000);
    expect(plan.totalCost).toBe(4_000_000);
    expect(plan.costPerXp).toBeCloseTo(4000 / 480, 10);
  });

  // You cannot build 0.2 of a larder, and buying 8 planks short leaves the
  // player one build away from their goal.
  it('rounds the build count up', () => {
    const plan = planConstruction(OAK_LARDER, 481, PRICES);

    expect(plan.builds).toBe(2);
    expect(plan.materials[0]!.totalQuantity).toBe(16);
  });

  it('sums several materials', () => {
    const plan = planConstruction(
      {
        ...OAK_LARDER,
        materials: [
          { item: 'Oak plank', quantity: 8 },
          { item: 'Steel nails', quantity: 8 },
        ],
      },
      480,
      PRICES,
    );

    expect(plan.totalCost).toBe(8 * 500 + 8 * 10);
  });

  /**
   * A total that quietly omits an unpriced material reads as a bargain. Null
   * plus a named item is the honest answer.
   */
  it('reports a null total and names the material when a price is missing', () => {
    const plan = planConstruction(
      {
        ...OAK_LARDER,
        materials: [
          { item: 'Oak plank', quantity: 8 },
          { item: 'Mystery plank', quantity: 2 },
        ],
      },
      480,
      PRICES,
    );

    expect(plan.totalCost).toBeNull();
    expect(plan.costPerXp).toBeNull();
    expect(plan.unpricedItems).toEqual(['Mystery plank']);
    // Quantities are unaffected — the shopping list is still useful.
    expect(plan.materials[1]!.totalQuantity).toBe(2);
    expect(plan.materials[1]!.lineCost).toBeNull();
  });

  it('produces a zero-cost plan for a goal that is already met', () => {
    const plan = planConstruction(OAK_LARDER, 0, PRICES);

    expect(plan.builds).toBe(0);
    expect(plan.hours).toBe(0);
    expect(plan.materials[0]!.totalQuantity).toBe(0);
    expect(plan.totalCost).toBe(0);
  });

  it('never throws when no prices are available at all', () => {
    const plan = planConstruction(OAK_LARDER, 480_000, {});

    expect(plan.builds).toBe(1000);
    expect(plan.totalCost).toBeNull();
    expect(plan.unpricedItems).toEqual(['Oak plank']);
  });
});

describe('buildsAtLevel', () => {
  it('includes only builds at or below the level', () => {
    const builds = buildsAtLevel(33);

    expect(builds.every((build) => build.minLevel <= 33)).toBe(true);
    expect(builds.map((build) => build.id)).toContain('oak-larder');
    expect(builds.map((build) => build.id)).not.toContain('gnome-bench');
  });
});

describe('the shipped construction data', () => {
  it('lists every material name exactly once', () => {
    const names = constructionItemNames();

    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain('Oak plank');
  });

  it('plans every shipped build without throwing when prices are absent', () => {
    for (const build of CONSTRUCTION_BUILDS) {
      const plan = planConstruction(build, 1_000_000, {});

      expect(plan.builds, build.id).not.toBeNull();
      expect(plan.totalCost, build.id).toBeNull();
    }
  });
});
