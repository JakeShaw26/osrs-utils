/**
 * Shapes for the authored skilling data in `./data/*.json`.
 *
 * The JSON is imported and cast to these types rather than parsed with zod at
 * runtime. The files are bundled static assets, not user input — a zod parse on
 * every cold start would buy nothing an attacker could defeat. The guarantee is
 * bought at CI time instead: `data.test.ts` validates every file against a zod
 * schema, so a malformed hand-edit fails `npm run check` rather than production.
 */

/**
 * Where a number came from, recorded per method.
 *
 * PRD §3.3 is explicit that xp/hr rates are "authored estimates and inherently
 * contentious", and that failing to cite them turns every disagreement about
 * rates into a bug report. This field is the citation.
 */
export interface RateSource {
  title: string;
  url: string;
  /** ISO date the figure was read from `url`. */
  retrieved: string;
  /**
   * `wiki-guide` — copied from a published OSRS Wiki training guide.
   * `author-estimate` — a judgement call by whoever edited this file.
   *
   * Nothing in this repo may claim `wiki-guide` without a URL that states it.
   */
  basis: 'wiki-guide' | 'author-estimate';
}

/** One item consumed or produced by a single action. */
export interface ItemQuantity {
  /** Exact GE item name, matched case-insensitively against `/mapping`. */
  item: string;
  /**
   * May be fractional. A Chaos Altar offering consumes one bone but returns it
   * half the time, so the expected cost per action is 0.5 bones — expressing
   * that as a fraction keeps the cost model honest without a special case.
   */
  quantity: number;
}

export interface TrainingMethod {
  id: string;
  skill: string;
  name: string;
  minLevel: number;
  xpPerAction: number;
  /** THE CONTENTIOUS NUMBER. Always overridable by the user in the UI. */
  xpPerHour: number;
  inputs: ItemQuantity[];
  outputs: ItemQuantity[];
  note?: string;
  source: RateSource;
}

export interface TrainingMethodsFile {
  version: number;
  updated: string;
  methods: TrainingMethod[];
}

export interface ConstructionBuild {
  id: string;
  name: string;
  room: string;
  minLevel: number;
  xpPerBuild: number;
  materials: ItemQuantity[];
  xpPerHour: number;
}

export interface ConstructionBuildsFile {
  version: number;
  updated: string;
  source: RateSource;
  builds: ConstructionBuild[];
}

/** Rates that vary with diaries and attention are a range, not a point. */
export interface RateRange {
  low: number;
  high: number;
}

export interface AgilityCourse {
  id: string;
  name: string;
  minLevel: number;
  /** A game constant, unlike the rates below. */
  xpPerLap: number;
  xpPerHour: RateRange;
  marksPerHour: RateRange;
  /** The level at which the next course usually becomes better. */
  recommendedTo: number;
  note?: string;
}

export interface AgilityCoursesFile {
  version: number;
  updated: string;
  source: RateSource;
  courses: AgilityCourse[];
}

/**
 * Item name (lowercased) to unit price in gp, or null when the GE has no
 * usable price for it.
 *
 * Null is a first-class value, not an error. Untradeable items, items with
 * one-sided order books and items whose name we failed to match all land here,
 * and a costing built on a guessed price is worse than one that says it does
 * not know.
 */
export type ItemPrices = Record<string, number | null>;
