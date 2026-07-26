/**
 * Parses the numbers players actually type into a quantity field.
 *
 * WHY THIS EXISTS
 *
 * `<input type="number">` rejects `1,000` and `13m` by returning an empty
 * string, so a naive `Number(e.target.value)` silently reads them as 0 — the
 * calculator then confidently answers the wrong question. Players type OSRS
 * shorthand constantly, because the game itself renders "13,034,431" as "13M"
 * and its own quantity boxes accept `k`/`m`/`b`.
 *
 * So the inputs in this feature are `type="text"` with `inputMode="numeric"`
 * and this parser in front of them. That trades the native spinner for
 * accepting what people write, which is the better trade for a calculator.
 *
 * Deliberately NOT in `lib/utils/`: five feature branches are in flight and a
 * shared-file collision is more expensive than a later move. Promoting this to
 * `lib/utils/parse-quantity.ts` is a good follow-up once the branches land.
 */

/** `null` means "not a number I can read", distinct from a legitimate 0. */
export type ParsedQuantity = number | null;

const SUFFIX_MULTIPLIERS: Record<string, number> = {
  k: 1_000,
  m: 1_000_000,
  b: 1_000_000_000,
};

/**
 * Reads `"1,000"`, `"1k"`, `"1.5m"`, `"13,034,431"`, `" 99 "` and `"2b"`.
 *
 * Rejects anything else — including `"1k5"`, `"1.2.3"` and `"abc"` — rather
 * than salvaging a leading digit. `parseFloat("12abc")` returns 12, which is
 * how a typo becomes a plausible-looking wrong answer instead of a visible
 * validation message.
 *
 * Negative values parse (the minus sign is accepted) so that callers can tell
 * "you typed -5" apart from "you typed nonsense" and phrase the error properly.
 */
export function parseQuantity(raw: string | number | null | undefined): ParsedQuantity {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (raw === null || raw === undefined) return null;

  // Strip separators players paste from the wiki or a spreadsheet. `\s` covers
  // the non-breaking and narrow no-break spaces that copying out of a rendered
  // table produces — they are invisible and would otherwise fail the match.
  const cleaned = raw.trim().toLowerCase().replace(/[,\s]/g, '');
  if (cleaned === '') return null;

  const match = /^(-?)(\d+(?:\.\d+)?)(k|m|b)?$/.exec(cleaned);
  if (!match) return null;

  const [, sign, digits, suffix] = match;
  const magnitude = Number(digits) * (suffix ? (SUFFIX_MULTIPLIERS[suffix] ?? 1) : 1);
  if (!Number.isFinite(magnitude)) return null;

  return sign === '-' ? -magnitude : magnitude;
}

/**
 * `parseQuantity` restricted to whole, non-negative counts — XP totals, levels,
 * item quantities. Fractional input truncates towards zero, matching the game:
 * you have 13,034,431 XP, never 13,034,431.6.
 */
export function parseCount(raw: string | number | null | undefined): ParsedQuantity {
  const value = parseQuantity(raw);
  if (value === null || value < 0) return null;
  return Math.trunc(value);
}

/** Whole-number display with thousands separators, for reading back a value. */
export function formatCount(value: number): string {
  return Math.trunc(value).toLocaleString('en-GB');
}
