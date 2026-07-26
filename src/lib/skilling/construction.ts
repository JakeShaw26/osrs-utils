import rawBuilds from './data/construction-builds.json';
import { totalCost } from './costing';
import { actionsRequired, hoursRequired } from './xp';
import type { ConstructionBuild, ConstructionBuildsFile, ItemPrices } from './types';

/**
 * Construction cost calculator (PRD §3.3: "material lists per item authored;
 * prices live").
 *
 * Kept separate from the general training comparator even though a build is
 * arguably just a method: Construction is asked a different question. Nobody
 * wants "gp per xp for oak larders" in the abstract — they want "how many
 * planks do I buy, and what will the shopping list cost", which is a materials
 * total, not a rate.
 */

const buildsFile = rawBuilds as unknown as ConstructionBuildsFile;

export const CONSTRUCTION_BUILDS: readonly ConstructionBuild[] = buildsFile.builds;
export const CONSTRUCTION_DATA_VERSION = buildsFile.version;
export const CONSTRUCTION_DATA_UPDATED = buildsFile.updated;
export const CONSTRUCTION_SOURCE = buildsFile.source;

/** Every material name across all builds — what the page fetches prices for. */
export function constructionItemNames(
  builds: readonly ConstructionBuild[] = CONSTRUCTION_BUILDS,
): string[] {
  const names = new Set<string>();
  for (const build of builds) {
    for (const { item } of build.materials) names.add(item);
  }
  return [...names];
}

export interface MaterialLine {
  item: string;
  /** Per build. */
  perBuild: number;
  /** Rounded up: you cannot buy 0.4 of a plank. */
  totalQuantity: number;
  unitPrice: number | null;
  lineCost: number | null;
}

export interface ConstructionPlan {
  build: ConstructionBuild;
  /** Builds needed for the goal, rounded up. Null if XP per build is 0. */
  builds: number | null;
  hours: number | null;
  materials: MaterialLine[];
  /** Whole shopping list. Null when any material is unpriced. */
  totalCost: number | null;
  costPerXp: number | null;
  unpricedItems: string[];
}

/**
 * Turns "I want 480,000 more Construction XP building oak larders" into a
 * shopping list.
 *
 * Quantities round up at the *total*, not per build, so 1,000 builds of 8
 * planks is 8,000 planks rather than 8,000 planks plus rounding drift.
 */
export function planConstruction(
  build: ConstructionBuild,
  xpRemaining: number,
  prices: ItemPrices,
): ConstructionPlan {
  const builds = actionsRequired(xpRemaining, build.xpPerBuild);

  const materials: MaterialLine[] = build.materials.map(({ item, quantity }) => {
    const price = prices[item.toLowerCase()] ?? null;
    const totalQuantity = builds === null ? 0 : Math.ceil(builds * quantity);
    return {
      item,
      perBuild: quantity,
      totalQuantity,
      unitPrice: price,
      lineCost: price === null ? null : price * totalQuantity,
    };
  });

  const perBuildTotals = totalCost(build.materials, prices);
  const unpricedItems = perBuildTotals.unpriced;

  const total =
    unpricedItems.length > 0
      ? null
      : materials.reduce((sum, line) => sum + (line.lineCost ?? 0), 0);

  return {
    build,
    builds,
    hours: hoursRequired(xpRemaining, build.xpPerHour),
    materials,
    totalCost: total,
    costPerXp:
      perBuildTotals.total === null || build.xpPerBuild <= 0
        ? null
        : perBuildTotals.total / build.xpPerBuild,
    unpricedItems,
  };
}

/**
 * Builds a player can actually make right now.
 *
 * Levels are boostable in game, so this filters a display rather than enforcing
 * a rule — the page still offers everything, it just marks what is out of reach.
 */
export function buildsAtLevel(
  level: number,
  builds: readonly ConstructionBuild[] = CONSTRUCTION_BUILDS,
): ConstructionBuild[] {
  return builds.filter((build) => build.minLevel <= level);
}
