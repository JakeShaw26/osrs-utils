/**
 * High alchemy profit.
 *
 * Profit = high alch value - buy price - nature rune price. (PRD §3.1)
 *
 * Every input comes from the one prices source: `highalch` and `limit` from
 * `/mapping`, the item's and the nature rune's prices from `/latest`. Nothing
 * here is hardcoded except the cast rate, which is a game constant with its
 * derivation written down below.
 *
 * The part that stops this being a subtraction is the buy limit. A 200gp
 * profit per cast is meaningless if the GE only lets you buy 70 of the item
 * every four hours — the honest hourly figure is bounded by resupply, not by
 * how fast you can click.
 */

/** Nature rune, from `/mapping`. Stable game id; the *price* is always fetched. */
export const NATURE_RUNE_ITEM_ID = 561;

/**
 * Casts per hour of continuous alching.
 *
 * High Level Alchemy is a 5-tick spell (3 seconds), giving a theoretical 1,200
 * casts/hour. In practice that is achievable while alching from the inventory
 * with no interruption, so it is the right ceiling for a "best case" figure —
 * and it is exposed as an assumption in the UI rather than presented as fact,
 * because bank trips and lag make the real number lower.
 */
export const ALCH_CASTS_PER_HOUR = 1_200;

/** The GE buy limit window: limits are "per 4 hours". */
export const BUY_LIMIT_WINDOW_HOURS = 4;

export interface AlchInput {
  /** `highalch` from /mapping. Absent on unalchable items. */
  highAlchValue: number | null | undefined;
  /** What you pay per item — instant-buy (`low`) is the realistic figure. */
  buyPrice: number | null | undefined;
  /** Live nature rune price per cast. */
  natureRunePrice: number | null | undefined;
  /** `limit` from /mapping — items purchasable per 4 hours. Absent means unlimited. */
  buyLimit?: number | null;
}

export interface AlchResult {
  /** Profit for a single cast. Negative when alching burns money, which is common. */
  profitPerCast: number;
  /** True when the item costs more than it alches for. */
  isLoss: boolean;
  /**
   * Casts per hour you can actually sustain: the lesser of how fast you can
   * cast and how fast the GE will sell you more. Null when the item has no
   * buy limit (then the cast rate is the only bound).
   */
  sustainableCastsPerHour: number;
  /** Whether resupply, not casting speed, is the binding constraint. */
  limitedByBuyLimit: boolean;
  /** Realistic gp/hour: `profitPerCast * sustainableCastsPerHour`. */
  profitPerHour: number;
  /** Best-case gp/hour ignoring the buy limit, for comparison. */
  unlimitedProfitPerHour: number;
  /** Profit from exhausting one full 4-hour buy limit. Null when unlimited. */
  profitPerBuyLimit: number | null;
  /** True when the item cannot be alched at all. */
  unalchable: boolean;
}

function toFiniteNonNegative(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

export function calculateAlchProfit({
  highAlchValue,
  buyPrice,
  natureRunePrice,
  buyLimit,
}: AlchInput): AlchResult {
  const alchValue = toFiniteNonNegative(highAlchValue);
  const cost = toFiniteNonNegative(buyPrice);
  const nature = toFiniteNonNegative(natureRunePrice);

  const profitPerCast = alchValue - cost - nature;

  // An unlimited item is bounded only by cast speed. A limited one refills at
  // `limit / 4` per hour, which for most alchables is far below 1,200.
  const limit =
    typeof buyLimit === 'number' && Number.isFinite(buyLimit) && buyLimit > 0
      ? buyLimit
      : null;
  const resupplyPerHour = limit === null ? Infinity : limit / BUY_LIMIT_WINDOW_HOURS;

  const sustainableCastsPerHour = Math.floor(
    Math.min(ALCH_CASTS_PER_HOUR, resupplyPerHour),
  );

  return {
    profitPerCast,
    isLoss: profitPerCast < 0,
    sustainableCastsPerHour,
    limitedByBuyLimit: resupplyPerHour < ALCH_CASTS_PER_HOUR,
    profitPerHour: profitPerCast * sustainableCastsPerHour,
    unlimitedProfitPerHour: profitPerCast * ALCH_CASTS_PER_HOUR,
    profitPerBuyLimit: limit === null ? null : profitPerCast * limit,
    unalchable: alchValue === 0,
  };
}

/**
 * The minimum an item must trade to be worth listing as an alch opportunity.
 *
 * Alching needs a steady resupply, so an item with a fat theoretical profit and
 * two trades an hour is the same trap as an illiquid flip: you cannot buy
 * enough of it to earn the gp/hr the table promises. Filtering here rather than
 * warning in the UI is the right call for a *ranked* table — a list sorted by
 * profit will always be topped by whatever nobody trades.
 */
export const MIN_ALCH_VOLUME_PER_5M = 5;

/** The subset of a market row this ranking needs. Structural, so it is testable without the server module. */
export interface AlchCandidate {
  id: number;
  name: string;
  highAlch: number | null;
  buyPrice: number | null;
  buyLimit: number | null;
  recentVolume: number | null;
}

export interface AlchOpportunity<T extends AlchCandidate = AlchCandidate> {
  item: T;
  result: AlchResult;
}

/**
 * Ranks alchable items by realistic gp/hour.
 *
 * Sorted by `profitPerHour`, NOT by `profitPerCast`. Per-cast profit is the
 * number that looks impressive and the number that misleads: a 3,000gp/cast
 * item with a buy limit of 8 earns 6,000gp/hour, which loses to a 60gp/cast
 * item you can buy 13,000 of. The buy limit is the whole story, so it is what
 * the ordering reflects.
 */
export function rankAlchOpportunities<T extends AlchCandidate>(
  candidates: readonly T[],
  natureRunePrice: number | null,
  limit = 50,
): AlchOpportunity<T>[] {
  const opportunities: AlchOpportunity<T>[] = [];

  for (const item of candidates) {
    if (item.highAlch === null || item.buyPrice === null) continue;
    if ((item.recentVolume ?? 0) < MIN_ALCH_VOLUME_PER_5M) continue;

    const result = calculateAlchProfit({
      highAlchValue: item.highAlch,
      buyPrice: item.buyPrice,
      natureRunePrice,
      buyLimit: item.buyLimit,
    });

    if (result.profitPerCast <= 0) continue;

    opportunities.push({ item, result });
  }

  opportunities.sort((a, b) => b.result.profitPerHour - a.result.profitPerHour);
  return opportunities.slice(0, limit);
}
