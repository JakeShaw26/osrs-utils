import { parseQuantity as parseShorthand } from '@/lib/utils/parse-quantity';

/**
 * Parses the shorthand OSRS players actually type into price fields.
 *
 * The game's own trade interface accepts `10k` / `2.5m` / `1b`, so players type
 * that everywhere, and they paste `1,000,000` out of the wiki. A plain
 * `<input type="number">` rejects all of those — it yields an empty string, so
 * the calculator silently reads 0 and shows a confidently wrong margin rather
 * than an error. That is why the price inputs in this feature are
 * `inputMode="decimal"` text fields parsed here instead.
 *
 * Returns `null` for anything unparseable so the caller can distinguish "not
 * filled in yet" from "zero", which are different states in a calculator.
 *
 * The shorthand reading itself now lives in `lib/utils/parse-quantity.ts` —
 * this feature and Skilling wrote the same parser independently. What stays
 * here is what is specific to *money*: coins are whole, and a price of zero is
 * not a price.
 */

export function parseGp(raw: string | null | undefined): number | null {
  const value = parseShorthand(raw);
  if (value === null) return null;

  // GP is a whole number of coins. Truncate towards zero rather than rounding,
  // matching lib/utils/format-gp.ts — money is never overstated.
  return Math.trunc(value);
}

/**
 * Same, but rejects negatives and zero.
 *
 * A price of 0 is not a price, and every calculator here divides by the buy
 * price at some point (ROI). Screening it out once, here, is cheaper than an
 * `Infinity` guard in each of them.
 */
export function parsePositiveGp(raw: string | null | undefined): number | null {
  const value = parseGp(raw);
  if (value === null || value <= 0) return null;
  return value;
}

/**
 * Parses a whole quantity (item counts, buy limits).
 *
 * Shares the shorthand — "buy 10k cannonballs" is how the quantity is spoken —
 * but a fractional item does not exist, so anything below 1 is rejected.
 */
export function parseQuantity(raw: string | null | undefined): number | null {
  const value = parseGp(raw);
  if (value === null || value < 1) return null;
  return value;
}
