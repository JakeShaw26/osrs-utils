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
 */

const SUFFIX_MULTIPLIERS: Record<string, number> = {
  k: 1_000,
  m: 1_000_000,
  b: 1_000_000_000,
};

export function parseGp(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;

  // Strip separators and whitespace: thousands separators are display
  // formatting, and both `,` and a non-breaking space arrive via copy-paste.
  const cleaned = raw.replace(/[\s,_ ]/g, '').toLowerCase();
  if (cleaned === '') return null;

  const match = /^(-?\d*\.?\d+)([kmb]?)$/.exec(cleaned);
  if (!match) return null;

  const [, digits, suffix] = match;
  const value = Number(digits);
  if (!Number.isFinite(value)) return null;

  const scaled = value * (suffix ? (SUFFIX_MULTIPLIERS[suffix] ?? 1) : 1);

  // GP is a whole number of coins. Truncate towards zero rather than rounding,
  // matching lib/utils/format-gp.ts — money is never overstated.
  return Math.trunc(scaled);
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
