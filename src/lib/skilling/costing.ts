import type { ItemPrices, ItemQuantity } from './types';

/**
 * Turning an authored material list plus live prices into gp and gp/xp.
 *
 * Shared by the training comparator and the construction calculator, because
 * "6 mahogany planks costs X" is the same sum in both places.
 */

export interface CostBreakdown {
  /** gp spent on inputs for one action. Null when any input price is unknown. */
  inputCost: number | null;
  /** gp recovered by selling the outputs. Null when any output price is unknown. */
  outputValue: number | null;
  /** `inputCost - outputValue`. **Negative means the method makes money.** */
  netCost: number | null;
  /**
   * Items whose price could not be resolved, by name.
   *
   * Surfaced rather than swallowed. A cost that silently omits an ingredient
   * looks like a bargain, and the items most likely to be unpriced — new,
   * untradeable, or thinly traded — are exactly the ones a player would be
   * misled about.
   */
  unpricedItems: string[];
}

/** Case-insensitive lookup. `undefined` (absent) and `null` (no price) both mean unknown. */
export function unitPrice(prices: ItemPrices, item: string): number | null {
  return prices[item.toLowerCase()] ?? null;
}

/**
 * Total gp for a list of item quantities.
 *
 * Returns null — not a partial total — if any single price is missing. A
 * partial total is a number a user will read as the answer.
 *
 * A price of **0** is not missing. Zero is a real, if unusual, market value and
 * it contributes zero; conflating it with "unknown" would blank out the whole
 * costing over one worthless ingredient.
 */
export function totalCost(
  items: readonly ItemQuantity[],
  prices: ItemPrices,
): { total: number | null; unpriced: string[] } {
  const unpriced: string[] = [];
  let total = 0;

  for (const { item, quantity } of items) {
    const price = unitPrice(prices, item);
    if (price === null) {
      unpriced.push(item);
      continue;
    }
    total += price * quantity;
  }

  return { total: unpriced.length > 0 ? null : total, unpriced };
}

export function costBreakdown(
  inputs: readonly ItemQuantity[],
  outputs: readonly ItemQuantity[],
  prices: ItemPrices,
): CostBreakdown {
  const inputSide = totalCost(inputs, prices);
  const outputSide = totalCost(outputs, prices);

  const netCost =
    inputSide.total === null || outputSide.total === null
      ? null
      : inputSide.total - outputSide.total;

  return {
    inputCost: inputSide.total,
    outputValue: outputSide.total,
    netCost,
    unpricedItems: [...inputSide.unpriced, ...outputSide.unpriced],
  };
}

/**
 * gp per XP — the number the comparator sorts on.
 *
 * Null when the cost is unknown or the XP rate is non-positive. Note this can
 * legitimately be negative: profitable methods (prayer potions) pay you to
 * train, and clamping that to zero would hide the single most useful fact about
 * them.
 */
export function gpPerXp(netCost: number | null, xpPerAction: number): number | null {
  if (netCost === null) return null;
  if (!Number.isFinite(xpPerAction) || xpPerAction <= 0) return null;
  return netCost / xpPerAction;
}

/** Total gp to cover `xpRemaining`. Null when either side is unknown. */
export function totalGpForXp(
  gpPerXpValue: number | null,
  xpRemaining: number,
): number | null {
  if (gpPerXpValue === null) return null;
  if (!Number.isFinite(xpRemaining) || xpRemaining <= 0) return 0;
  return gpPerXpValue * xpRemaining;
}
