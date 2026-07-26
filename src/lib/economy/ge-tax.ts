/**
 * Grand Exchange tax — the single source of truth for every rate and threshold.
 *
 * THIS FILE RESOLVES OPEN QUESTION V3. Nothing here may be inlined at a call
 * site: the rate has already changed once (1% -> 2%) and the cap has been
 * raised, so a number copied into a component is a number that will be wrong
 * later and wrong silently. Every constant below records where it came from and
 * when it was checked.
 *
 * Source: OSRS Wiki, "Grand Exchange" -> "Convenience fee and item sink"
 *   <https://oldschool.runescape.wiki/w/Grand_Exchange>
 *   (the page `Grand Exchange tax` is a redirect into that section)
 * Verified: 2026-07-26, read live from the wiki, not from memory.
 *
 * Wiki wording, quoted so a future reader can diff it rather than re-derive it:
 *
 *   "Most transactions on the Grand Exchange are subject to a 2% tax, or
 *    convenience fee, capped at a maximum of 5 million coins per item."
 *
 *   "The 2% tax rounds down to the nearest whole number, so items sold for
 *    below 50 coins have a tax of less than one coin, and so have no tax
 *    obligation."
 *
 * History: introduced at 1% on 2021-12-09; raised to 2% on 2025-05-29.
 */

/** 2% of the sale price. Wiki, verified 2026-07-26. */
export const GE_TAX_RATE = 0.02;

/**
 * Maximum tax charged **per item**, not per transaction or per stack.
 *
 * At a 2% rate this binds from a unit price of 250,000,000 upwards, so it only
 * matters for a handful of items — but those are exactly the ones where a
 * flipper's margin is large enough to care about.
 *
 * Wiki, verified 2026-07-26.
 */
export const GE_TAX_CAP_PER_ITEM = 5_000_000;

/**
 * Below this unit price the tax is zero.
 *
 * This is a *consequence* of rounding down, not a separate rule the game
 * applies: 2% of 49 is 0.98, which floors to 0. It is named anyway because the
 * UI needs to explain "no tax" to a user, and re-deriving the number at each
 * call site is how it drifts. Keep it consistent with the rate — if the rate
 * ever changes, this threshold changes with it.
 */
export const GE_TAX_FREE_BELOW = Math.ceil(1 / GE_TAX_RATE);

/**
 * Items the game never taxes, lowercased for lookup.
 *
 * Mostly starter tools and low-level consumables — Jagex's stated reason is to
 * avoid inhibiting trade on items new players depend on. Bonds are exempt
 * because they are already charged a fee when made tradeable.
 *
 * Matched by **name**, because that is how the wiki publishes the list and
 * because item ids differ per charge variant (`Ring of dueling(8)` is a
 * different id from `(7)`). The wiki's list names the specific charged variants
 * it does, so we mirror it exactly rather than normalising away the `(8)`.
 *
 * Source: OSRS Wiki "Grand Exchange" exemption table, verified 2026-07-26.
 */
export const GE_TAX_EXEMPT_ITEMS: ReadonlySet<string> = new Set(
  [
    // Bonds — already carry their own conversion fee.
    'Old school bond',
    // Consumables
    'Energy potion',
    'Bronze arrow',
    'Bronze dart',
    'Iron arrow',
    'Iron dart',
    'Mind rune',
    'Steel arrow',
    'Steel dart',
    // Low-level food
    'Bass',
    'Bread',
    'Cake',
    'Cooked chicken',
    'Cooked meat',
    'Herring',
    'Lobster',
    'Mackerel',
    'Meat pie',
    'Pike',
    'Salmon',
    'Shrimps',
    'Tuna',
    // Teleports and travel jewellery
    'Ardougne teleport',
    'Camelot teleport',
    'Civitas illa fortis teleport',
    'Falador teleport',
    'Games necklace(8)',
    'Kourend castle teleport',
    'Lumbridge teleport',
    'Ring of dueling(8)',
    'Teleport to house',
    'Varrock teleport',
    // Tools
    'Chisel',
    'Gardening trowel',
    'Glassblowing pipe',
    'Hammer',
    'Needle',
    'Pestle and mortar',
    'Rake',
    'Saw',
    'Secateurs',
    'Seed dibber',
    'Shears',
    'Spade',
    'Watering can',
  ].map((name) => name.toLowerCase()),
);

/** True when the game charges no tax on this item at any price. */
export function isTaxExempt(itemName: string | null | undefined): boolean {
  if (!itemName) return false;
  return GE_TAX_EXEMPT_ITEMS.has(itemName.toLowerCase());
}

/**
 * Tax the game takes from the seller on **one** item sold at `salePrice`.
 *
 * Rounds down, because the game does. Rounding to nearest would overstate the
 * tax by up to a coin per item, which is invisible on a twisted bow and
 * material on a 100k-item flip of cannonballs.
 *
 * A negative or non-finite price yields 0 rather than throwing: this runs on
 * every keystroke of a free-text price field, and a half-typed "-" is not an
 * exceptional condition.
 */
export function geTax(salePrice: number, itemName?: string | null): number {
  if (!Number.isFinite(salePrice) || salePrice <= 0) return 0;
  if (isTaxExempt(itemName)) return 0;

  return Math.min(Math.floor(salePrice * GE_TAX_RATE), GE_TAX_CAP_PER_ITEM);
}

/** What the seller actually receives for one item after tax. */
export function netSaleProceeds(salePrice: number, itemName?: string | null): number {
  if (!Number.isFinite(salePrice) || salePrice <= 0) return 0;
  return salePrice - geTax(salePrice, itemName);
}
