import rawMethods from './data/training-methods.json';
import { costBreakdown, gpPerXp, totalGpForXp } from './costing';
import { actionsRequired, hoursRequired } from './xp';
import type { ItemPrices, TrainingMethod, TrainingMethodsFile } from './types';

/**
 * The training method comparator's data and maths.
 *
 * THE DESIGN CONSTRAINT WORTH KNOWING (PRD §3.3)
 *
 * xp/hr rates are authored estimates and are "inherently contentious". Two
 * things follow, and both are structural rather than cosmetic:
 *
 *  1. **Every rate is overridable.** `compareMethods` takes an `xpPerHour`
 *     override map, so a member who disagrees changes the number and gets their
 *     own answer instead of filing a bug.
 *  2. **Every rate carries its source.** `method.source` is required by the
 *     type, so a new method cannot be added without saying where its rate came
 *     from.
 *
 * The rates live in versioned JSON in this repo — never in the database — so a
 * change to them arrives as a reviewable diff in a pull request. See
 * docs/adr/0016-authored-skilling-rates.md.
 */

// Cast rather than parse: the JSON is a bundled static asset and `data.test.ts`
// validates it against a zod schema in CI. See types.ts.
const methodsFile = rawMethods as unknown as TrainingMethodsFile;

export const TRAINING_METHODS: readonly TrainingMethod[] = methodsFile.methods;
export const TRAINING_METHODS_VERSION = methodsFile.version;
export const TRAINING_METHODS_UPDATED = methodsFile.updated;

/** Skills that have at least one authored method, in first-seen order. */
export function trainableSkills(
  methods: readonly TrainingMethod[] = TRAINING_METHODS,
): string[] {
  return [...new Set(methods.map((method) => method.skill))];
}

export function methodsForSkill(
  skill: string,
  methods: readonly TrainingMethod[] = TRAINING_METHODS,
): TrainingMethod[] {
  return methods.filter((method) => method.skill === skill);
}

/** Every item name any method touches — what the page needs prices for. */
export function requiredItemNames(
  methods: readonly TrainingMethod[] = TRAINING_METHODS,
): string[] {
  const names = new Set<string>();
  for (const method of methods) {
    for (const { item } of [...method.inputs, ...method.outputs]) names.add(item);
  }
  return [...names];
}

export interface ComparedMethod {
  method: TrainingMethod;
  /** The rate actually used — the user's override if they set one. */
  xpPerHour: number;
  /** True when `xpPerHour` differs from the authored value. */
  overridden: boolean;
  /** True when the player's current level is below `method.minLevel`. */
  locked: boolean;
  netCostPerAction: number | null;
  gpPerXp: number | null;
  /** Whole actions, rounded UP — you cannot do a fraction of one. */
  actions: number | null;
  hours: number | null;
  totalGp: number | null;
  unpricedItems: string[];
}

export interface CompareOptions {
  prices: ItemPrices;
  /** XP between the player and their goal. 0 is fine — costs come out 0. */
  xpRemaining: number;
  /** Method id to the user's own xp/hr. The escape hatch from an argued rate. */
  xpPerHourOverrides?: Record<string, number>;
  /** Marks methods above this level as locked. Undefined means "show all". */
  currentLevel?: number;
}

/**
 * Costs every method against one goal.
 *
 * Does not sort or filter. Ordering is a presentation choice (cheapest? fastest?
 * the one I can actually do?) and belongs to the component, which lets the user
 * pick — see `sortComparedMethods`.
 */
export function compareMethods(
  methods: readonly TrainingMethod[],
  { prices, xpRemaining, xpPerHourOverrides = {}, currentLevel }: CompareOptions,
): ComparedMethod[] {
  return methods.map((method) => {
    const override = xpPerHourOverrides[method.id];
    const usable = override !== undefined && Number.isFinite(override) && override > 0;
    const xpPerHour = usable ? override : method.xpPerHour;

    const cost = costBreakdown(method.inputs, method.outputs, prices);
    const perXp = gpPerXp(cost.netCost, method.xpPerAction);

    return {
      method,
      xpPerHour,
      overridden: usable && override !== method.xpPerHour,
      locked: currentLevel !== undefined && currentLevel < method.minLevel,
      netCostPerAction: cost.netCost,
      gpPerXp: perXp,
      actions: actionsRequired(xpRemaining, method.xpPerAction),
      hours: hoursRequired(xpRemaining, xpPerHour),
      totalGp: totalGpForXp(perXp, xpRemaining),
      unpricedItems: cost.unpricedItems,
    };
  });
}

export type MethodSort = 'fastest' | 'cheapest' | 'level';

/**
 * Sorts a comparison, copying first.
 *
 * The copy is not incidental. `TRAINING_METHODS` is a module-level constant
 * shared by every request in a warm serverless instance, and an in-place sort
 * of anything derived from it is a bug that only shows up under concurrency —
 * the same trap `sortByRank` documents in lib/clan/ranks.ts.
 *
 * Methods with an unknown cost sort last under `cheapest` rather than first.
 * `null` compared numerically is 0, which would rank "we have no idea what this
 * costs" as free.
 */
export function sortComparedMethods(
  compared: readonly ComparedMethod[],
  sort: MethodSort,
): ComparedMethod[] {
  const copy = [...compared];

  switch (sort) {
    case 'fastest':
      return copy.sort((a, b) => b.xpPerHour - a.xpPerHour);
    case 'level':
      return copy.sort((a, b) => a.method.minLevel - b.method.minLevel);
    case 'cheapest':
      return copy.sort((a, b) => {
        if (a.gpPerXp === null && b.gpPerXp === null) return 0;
        if (a.gpPerXp === null) return 1;
        if (b.gpPerXp === null) return -1;
        return a.gpPerXp - b.gpPerXp;
      });
  }
}
