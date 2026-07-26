import { geTax, isTaxExempt } from './ge-tax';

/**
 * Flipping maths: buy low, sell high, minus the Grand Exchange's cut.
 *
 * Pure functions, no network, no React — the whole point of keeping this in
 * lib/ is that the arithmetic can be tested at the tax threshold, at the cap
 * and on an inverted market without rendering anything.
 *
 * THE THING MOST FLIPPING TOOLS GET WRONG is presenting margin alone. A 400k
 * margin on an item that trades four times a day is not 400k of profit, it is
 * a position you cannot exit. `assessLiquidity` exists so the volume signal is
 * computed alongside the margin rather than bolted on as an optional column
 * that a user can miss. (PRD §3.1)
 */

/**
 * `low` and `high` come from the Wiki `/latest` feed and are named from the
 * *market's* perspective, which is the opposite of the flipper's:
 *
 *   - `low`  = the most recent instant-SELL price = what YOU pay to buy quickly
 *   - `high` = the most recent instant-BUY price  = what YOU receive selling
 *
 * Getting this backwards produces a plausible-looking negative margin, so the
 * mapping is named explicitly here rather than left to each call site.
 */
export interface FlipInput {
  /** What you pay per item (the `low` side of the book). */
  buyPrice: number;
  /** What you sell for per item (the `high` side). */
  sellPrice: number;
  /** How many you flip. Defaults to 1 — the per-item view. */
  quantity?: number;
  /** Used only to check the tax-exempt list. */
  itemName?: string | null;
}

export interface FlipResult {
  buyPrice: number;
  sellPrice: number;
  quantity: number;
  /** Sell minus buy, before tax. The number other tools stop at. */
  grossMarginPerItem: number;
  /** Tax on ONE item, already capped and floored. */
  taxPerItem: number;
  /** What you actually keep per item. May be negative. */
  netMarginPerItem: number;
  /** `netMarginPerItem * quantity`. */
  totalProfit: number;
  /** Capital required to open the position. */
  totalInvested: number;
  /** Net profit as a percentage of capital invested. Null when nothing is invested. */
  roiPercent: number | null;
  /** True when this item pays no tax at all. Worth surfacing — it changes the maths. */
  taxExempt: boolean;
  /** True when the 5m per-item cap is what limited the tax, not the 2% rate. */
  taxCapped: boolean;
  /** True when the flip loses money after tax. */
  isLoss: boolean;
}

export function calculateFlip({
  buyPrice,
  sellPrice,
  quantity = 1,
  itemName,
}: FlipInput): FlipResult {
  // Normalise before any arithmetic. These fields are fed straight from text
  // inputs, and NaN propagates silently through every downstream number.
  const buy = Number.isFinite(buyPrice) ? Math.max(0, Math.trunc(buyPrice)) : 0;
  const sell = Number.isFinite(sellPrice) ? Math.max(0, Math.trunc(sellPrice)) : 0;
  const qty = Number.isFinite(quantity) ? Math.max(0, Math.trunc(quantity)) : 0;

  const taxPerItem = geTax(sell, itemName);
  const grossMarginPerItem = sell - buy;
  const netMarginPerItem = grossMarginPerItem - taxPerItem;

  const totalInvested = buy * qty;
  const totalProfit = netMarginPerItem * qty;

  return {
    buyPrice: buy,
    sellPrice: sell,
    quantity: qty,
    grossMarginPerItem,
    taxPerItem,
    netMarginPerItem,
    totalProfit,
    totalInvested,
    roiPercent: totalInvested > 0 ? (totalProfit / totalInvested) * 100 : null,
    taxExempt: isTaxExempt(itemName),
    // Reconstructed rather than plumbed out of geTax: the cap bit is only
    // interesting for display, and threading it through would make the tax
    // function return a shape instead of a number.
    taxCapped: taxPerItem > 0 && taxPerItem === 5_000_000,
    isLoss: netMarginPerItem < 0,
  };
}

/* -------------------------------------------------------------------------- */
/* Liquidity                                                                   */
/* -------------------------------------------------------------------------- */

export type LiquidityLevel = 'unknown' | 'illiquid' | 'thin' | 'active';

export interface LiquidityAssessment {
  level: LiquidityLevel;
  /** Items traded per hour, extrapolated from the /5m window. */
  hourlyVolume: number | null;
  /**
   * How long it would take the market to absorb your quantity, in hours.
   * Null when volume is unknown or zero. This is the number that turns
   * "great margin" into "you will be holding this for two days".
   */
  hoursToFill: number | null;
  /** Plain-English reason, shown to the user rather than kept for debugging. */
  reason: string;
}

/**
 * Thresholds are in items/hour and are deliberately conservative.
 *
 * There is no authoritative definition of "illiquid" — these are judgement
 * calls, so they live here as named constants that can be argued with, rather
 * than as magic numbers inside a chain of ternaries.
 */
export const LIQUIDITY_THRESHOLDS = {
  /** Below this, a flip is a gamble on finding one specific buyer. */
  illiquid: 10,
  /** Below this it trades, but slowly enough that your order sets the price. */
  thin: 100,
} as const;

/**
 * The `/5m` endpoint reports volume over a five-minute block, so twelve blocks
 * make an hour. Extrapolating one block is noisy, and we say so in the UI
 * rather than pretending it is a measured hourly rate.
 */
const FIVE_MINUTE_BLOCKS_PER_HOUR = 12;

/**
 * Turns raw `/5m` volumes into a warning a flipper can act on.
 *
 * Both sides are summed: an item with 500 buys and 2 sells is not liquid in the
 * direction that matters, but an item you cannot buy is just as untradeable as
 * one you cannot sell, so total throughput is the honest headline and
 * `hoursToFill` is what exposes the size problem.
 */
export function assessLiquidity(
  fiveMinuteVolume:
    { highPriceVolume: number; lowPriceVolume: number } | null | undefined,
  quantity = 1,
): LiquidityAssessment {
  if (!fiveMinuteVolume) {
    return {
      level: 'unknown',
      hourlyVolume: null,
      hoursToFill: null,
      reason: 'No recent trade data — treat any margin here as unverified.',
    };
  }

  const blockVolume =
    Math.max(0, fiveMinuteVolume.highPriceVolume || 0) +
    Math.max(0, fiveMinuteVolume.lowPriceVolume || 0);
  const hourlyVolume = blockVolume * FIVE_MINUTE_BLOCKS_PER_HOUR;

  const qty = Number.isFinite(quantity) ? Math.max(0, Math.trunc(quantity)) : 0;
  const hoursToFill = hourlyVolume > 0 && qty > 0 ? qty / hourlyVolume : null;

  if (hourlyVolume < LIQUIDITY_THRESHOLDS.illiquid) {
    return {
      level: 'illiquid',
      hourlyVolume,
      hoursToFill,
      reason: `Only ~${hourlyVolume} traded per hour. A large margin here usually means nobody is buying.`,
    };
  }

  if (hourlyVolume < LIQUIDITY_THRESHOLDS.thin) {
    return {
      level: 'thin',
      hourlyVolume,
      hoursToFill,
      reason: `~${hourlyVolume} traded per hour. Expect a slow fill, and your own offer to move the price.`,
    };
  }

  return {
    level: 'active',
    hourlyVolume,
    hoursToFill,
    reason: `~${hourlyVolume} traded per hour. Liquid enough to enter and exit.`,
  };
}
