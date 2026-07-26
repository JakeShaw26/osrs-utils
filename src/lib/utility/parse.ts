/**
 * Parsing for the numbers people actually type.
 *
 * A bare `Number(value)` is wrong in three ways users hit constantly, and each
 * one produces `NaN` on screen rather than an error message:
 *
 *   `1,000`  pasted from the Grand Exchange, which prints separators
 *   `1.5m`   the notation the game itself uses everywhere
 *   `  12 `  whitespace from a copy-paste
 *
 * Returning `null` rather than `NaN` for bad input is the important part.
 * `NaN` propagates silently through arithmetic and surfaces as "NaN gp" three
 * components away; `null` forces the caller to decide what invalid looks like
 * at the point of entry, which is where the user can still fix it.
 */

const SUFFIX_MULTIPLIERS: Record<string, number> = {
  k: 1_000,
  m: 1_000_000,
  b: 1_000_000_000,
};

/**
 * Parses a gp amount. Returns null for anything unparseable or negative.
 *
 * Negative is rejected rather than clamped: you cannot carry -5 of an item, so
 * a minus sign is a typo, and silently turning it into 5 hides the typo.
 */
export function parseGpInput(raw: string): number | null {
  const trimmed = raw.trim().toLowerCase().replaceAll(',', '').replaceAll(' ', '');
  if (trimmed === '') return null;

  const suffix = trimmed.at(-1) ?? '';
  const multiplier = SUFFIX_MULTIPLIERS[suffix];
  const numeric = multiplier === undefined ? trimmed : trimmed.slice(0, -1);

  // Reject anything that is not a plain decimal. Number() happily accepts
  // '0x10', '1e5' and '' — none of which a user meant to type into a gp field.
  if (!/^\d+(\.\d+)?$/.test(numeric)) return null;

  const value = Number(numeric) * (multiplier ?? 1);
  if (!Number.isFinite(value)) return null;

  // Truncate: gp is an integer, and rounding 1.55m up would overstate a risk
  // total. Money is never rounded in this app's favour. (lib/utils/format-gp)
  return Math.floor(value);
}

/** Whole positive counts — stack sizes, quantities. Zero is not a stack. */
export function parseCountInput(raw: string): number | null {
  const value = parseGpInput(raw);
  if (value === null || value < 1) return null;
  return value;
}

/**
 * Positive rates, decimals preserved — "2.5 games per hour" is a real answer
 * that `parseGpInput` would floor to 2 and quietly overstate by 25%.
 */
export function parseRateInput(raw: string): number | null {
  const trimmed = raw.trim().replaceAll(',', '').replaceAll(' ', '');
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;

  const value = Number(trimmed);
  return Number.isFinite(value) && value > 0 ? value : null;
}
