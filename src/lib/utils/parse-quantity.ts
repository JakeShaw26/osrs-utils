/**
 * Parses the numbers players actually type.
 *
 * WHY THIS EXISTS
 *
 * `<input type="number">` rejects `1,000` and `13m` by returning an empty
 * string, so a naive `Number(e.target.value)` silently reads them as 0 — the
 * calculator then confidently answers the wrong question. Players type OSRS
 * shorthand constantly, because the game itself renders "13,034,431" as "13M"
 * and its own quantity boxes accept `k`/`m`/`b`.
 *
 * So the inputs across this app are `type="text"` with an appropriate
 * `inputMode`, parsed here. That trades the native spinner for accepting what
 * people write, which is the better trade for a calculator.
 *
 * WHY IT LIVES IN `lib/utils/`
 *
 * It was written twice, independently, by two feature agents working in
 * parallel — `lib/skilling/parse-quantity.ts` and the core of
 * `lib/economy/parse-gp.ts`. Both were kept feature-local on purpose while six
 * branches were in flight, because a shared-file collision would have cost more
 * than a later move. The branches have landed, so this is that move.
 *
 * What is shared is the *reading* of shorthand. What is NOT shared is what each
 * feature considers valid — GP truncates to whole coins, an item count cannot
 * be fractional or negative, an XP total can be neither. Those restrictions
 * stay with their features; only the parsing lives here.
 */

/** `null` means "not a number I can read", distinct from a legitimate 0. */
export type ParsedQuantity = number | null;

const SUFFIX_MULTIPLIERS: Record<string, number> = {
  k: 1_000,
  m: 1_000_000,
  b: 1_000_000_000,
};

/**
 * Reads `"1,000"`, `"1k"`, `"1.5m"`, `"13,034,431"`, `" 99 "`, `".5"` and `"2b"`.
 *
 * Rejects anything else — including `"1k5"`, `"1.2.3"` and `"abc"` — rather
 * than salvaging a leading digit. `parseFloat("12abc")` returns 12, which is
 * how a typo becomes a plausible-looking wrong answer instead of a visible
 * validation message.
 *
 * Sign and fraction are PRESERVED here, deliberately. A caller that forbids
 * them can tell "you typed -5" apart from "you typed nonsense" and phrase the
 * error properly; a parser that returned null for both could not.
 */
export function parseQuantity(raw: string | number | null | undefined): ParsedQuantity {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (raw === null || raw === undefined) return null;

  // Strip separators players paste from the wiki or a spreadsheet. `\s` covers
  // the non-breaking and narrow no-break spaces that copying out of a rendered
  // table produces — they are invisible and would otherwise fail the match.
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[,\s_]/g, '');
  if (cleaned === '') return null;

  const match = /^(-?)(\d*\.?\d+)(k|m|b)?$/.exec(cleaned);
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
