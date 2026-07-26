/**
 * Wilderness death-risk calculator — items kept on death.
 *
 * ─── PROVENANCE, AND WHY IT IS VERSIONED ────────────────────────────────────
 *
 * No API serves these rules. They are **authored data transcribed from the OSRS
 * Wiki**, and Jagex has changed them more than once (Death's Office, the
 * untradeable-reclaim rework, repeated Wilderness rebalances). A calculator
 * that silently encodes a superseded rule is worse than no calculator, because
 * a player trusts it and loses a bank.
 *
 * So the rules are a versioned, sourced dataset rather than magic numbers in a
 * function body: `DEATH_RULES_VERSION` is rendered in the UI, every clause
 * carries a `source`, and anything we are not certain about carries a
 * `confidence` below `documented` and is surfaced as such. (ADR-0019)
 *
 * ─── WHAT IS AND IS NOT MODELLED ────────────────────────────────────────────
 *
 * Modelled: the protected-item count under skull / Protect Item, ranking by
 * value, whole-stack protection, and the resulting risk total.
 *
 * NOT modelled, deliberately, because getting them subtly wrong is worse than
 * omitting them: untradeable reclaim costs at Death's Office, the value a
 * killer actually receives, item-specific exceptions, and the Ultimate Ironman
 * case. The UI states these exclusions rather than leaving a user to assume
 * they are covered.
 */

/** Bump whenever a clause below changes. Rendered in the UI. */
export const DEATH_RULES_VERSION = 'v1 — reviewed 2026-07-26';

export type RuleConfidence = 'documented' | 'community' | 'unverified';

export interface DeathRuleClause {
  id: string;
  statement: string;
  confidence: RuleConfidence;
  source: string;
}

export const DEATH_RULE_CLAUSES: readonly DeathRuleClause[] = [
  {
    id: 'kept-default',
    statement: 'Unskulled, you keep your 3 most valuable items.',
    confidence: 'documented',
    source: 'OSRS Wiki — “Items Kept on Death”',
  },
  {
    id: 'kept-protect-item',
    statement: 'The Protect Item prayer keeps one extra item, so 4 unskulled.',
    confidence: 'documented',
    source: 'OSRS Wiki — “Protect Item”',
  },
  {
    id: 'kept-skulled',
    statement: 'Skulled, you keep nothing — or 1 item with Protect Item active.',
    confidence: 'documented',
    source: 'OSRS Wiki — “Skull (status)”',
  },
  {
    id: 'ranking',
    statement:
      'Items are protected in descending order of value, so the cheapest things are always what you lose.',
    confidence: 'documented',
    source: 'OSRS Wiki — “Items Kept on Death”',
  },
  {
    id: 'stacks',
    statement:
      'A stack counts as one item and is protected whole — a protected stack of 10,000 is not split.',
    confidence: 'community',
    source:
      'Widely reported player behaviour; the ranking value used for a stack is not stated in a primary source, so this tool ranks by unit value.',
  },
  {
    id: 'valuation',
    statement:
      'Risk is valued at live Grand Exchange prices, which is an approximation of the game’s own death value.',
    confidence: 'unverified',
    source:
      'The game uses an internal death value that does not always equal the GE price, particularly for untradeables. Treat the total as indicative.',
  },
];

/**
 * One priced item offered by the picker.
 *
 * Declared here rather than in `item-prices.ts` because that module is
 * `server-only`, and a client component importing a type from it would drag the
 * server module into the browser bundle and fail the build. Types are erased at
 * compile time; the import is not.
 */
export interface PricedItem {
  id: string;
  name: string;
  /** GE mid price in gp. */
  unitValue: number;
}

export interface CarriedItem {
  /** Stable key for React and for tie-breaking. */
  id: string;
  name: string;
  /** GE value of ONE of this item, in gp. */
  unitValue: number;
  /** Stack size. A stack is one protectable item, however large. */
  quantity: number;
}

export interface DeathRiskOptions {
  skulled: boolean;
  protectItem: boolean;
}

/**
 * How many items survive the death.
 *
 * The whole rule set collapses to this table:
 *
 *            | no Protect Item | Protect Item
 *   unskulled|        3        |      4
 *   skulled  |        0        |      1
 */
export function keptItemCount({ skulled, protectItem }: DeathRiskOptions): number {
  const base = skulled ? 0 : 3;
  return base + (protectItem ? 1 : 0);
}

export interface DeathRiskResult {
  /** Highest-value first, matching the order the game protects them in. */
  kept: CarriedItem[];
  lost: CarriedItem[];
  /** Total gp value of everything lost. The headline number. */
  riskValue: number;
  keptValue: number;
  /** Value of the whole inventory, kept plus lost. */
  totalValue: number;
  /** The rule outcome, so the UI can say "keeping 4" without recomputing it. */
  keptCount: number;
}

/** Stack value. Separate function so the "stacks are whole" rule has one home. */
export function stackValue(item: CarriedItem): number {
  return item.unitValue * item.quantity;
}

/**
 * Splits a carried inventory into kept and lost, and totals the risk.
 *
 * Ranks by **unit** value, not stack value — see the `stacks` clause above.
 * That choice is visible here rather than buried, because it is the one place
 * this model could diverge from the game and a reader deserves to see it.
 *
 * Ties break by input order, so the result is deterministic: an unstable sort
 * over equal-valued items would make the "lost items" list shuffle between
 * renders for no reason a user could explain.
 */
export function calculateDeathRisk(
  items: readonly CarriedItem[],
  options: DeathRiskOptions,
): DeathRiskResult {
  const keptCount = keptItemCount(options);

  // Copy before sorting. The caller's array may be React state or a cached
  // server response, and sorting it in place mutates something it does not own.
  const ranked = [...items].sort((a, b) => b.unitValue - a.unitValue);

  // slice() past the end is fine and returns fewer — that is the "carrying
  // fewer items than you are allowed to keep" case, which needs no branch.
  const kept = ranked.slice(0, keptCount);
  const lost = ranked.slice(keptCount);

  const sum = (list: readonly CarriedItem[]) =>
    list.reduce((total, item) => total + stackValue(item), 0);

  const keptValue = sum(kept);
  const riskValue = sum(lost);

  return {
    kept,
    lost,
    keptValue,
    riskValue,
    totalValue: keptValue + riskValue,
    keptCount,
  };
}

/**
 * A short, curated set of items to price for the picker.
 *
 * **This list is why the page needs no per-request upstream call.** The names
 * resolve against the bulk `/mapping` + `/latest` responses that are already
 * cached, so the page costs zero extra requests however many people open it and
 * the client receives ~30 rows instead of the 4,000-entry mapping. Letting a
 * visitor search the full item list would mean a route that proxies the Wiki on
 * every keystroke — the open-proxy shape hard rule #5 exists to prevent.
 *
 * Names use the straight apostrophe the mapping itself uses, and are matched
 * case-insensitively. Anything unmatched is dropped and *reported* — a
 * renamed item must show up as a gap in the picker, never as a 0 gp row that
 * quietly understates someone's risk.
 */
export const COMMON_WILDERNESS_ITEMS: readonly string[] = [
  'Amulet of fury',
  'Ancient staff',
  'Armadyl chestplate',
  'Armadyl chainskirt',
  'Barrows gloves',
  'Berserker ring',
  "Black d'hide body",
  "Black d'hide chaps",
  'Bandos chestplate',
  'Bandos tassets',
  'Dragon boots',
  'Dragon claws',
  'Dragon defender',
  'Dragon scimitar',
  'Ghrazi rapier',
  'Granite maul',
  'Heavy ballista',
  "Karil's leathertop",
  "Karil's leatherskirt",
  "Mage's book",
  'Occult necklace',
  'Rune pouch',
  'Saradomin brew(4)',
  'Super restore(4)',
  'Toxic blowpipe',
  'Trident of the swamp',
  "Verac's flail",
  'Zaryte crossbow',
];
