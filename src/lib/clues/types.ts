/**
 * Treasure Trails domain types.
 *
 * Pure types and constants — no data, no network. The dataset itself lives in
 * `dataset.ts` and `npc-index.ts`; the solvers live beside them. Keeping the
 * shape here means a future contributor adding steps only reads one file.
 */

/** Scroll tiers, in the order the game presents them. */
export const CLUE_TIERS = [
  'beginner',
  'easy',
  'medium',
  'hard',
  'elite',
  'master',
] as const;

export type ClueTier = (typeof CLUE_TIERS)[number];

/**
 * Step kinds.
 *
 * Split deliberately into two groups, because the split is the whole reason
 * this feature could ship at all (ADR-0017):
 *
 *  - **Derivable** kinds (`anagram`, `cipher`) are solved by an algorithm over a
 *    name index. Coverage scales with the index, not with authoring effort, and
 *    a step nobody has catalogued still gets answered.
 *  - **Authored** kinds (`cryptic`, `emote`, `map`, `coordinate`, `puzzle`) have
 *    no derivation. Every one is hand-written prose, which is what makes the
 *    full corpus the largest content task in the product.
 */
export const CLUE_TYPES = [
  'anagram',
  'cipher',
  'cryptic',
  'emote',
  'map',
  'coordinate',
  'puzzle',
] as const;

export type ClueType = (typeof CLUE_TYPES)[number];

/** Kinds an algorithm can answer without the step being catalogued first. */
export const DERIVABLE_CLUE_TYPES: readonly ClueType[] = ['anagram', 'cipher'];

export const CLUE_TYPE_LABELS: Record<ClueType, string> = {
  anagram: 'Anagram',
  cipher: 'Cipher',
  cryptic: 'Cryptic',
  emote: 'Emote',
  map: 'Map',
  coordinate: 'Coordinate',
  puzzle: 'Puzzle box',
};

export const CLUE_TIER_LABELS: Record<ClueTier, string> = {
  beginner: 'Beginner',
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  elite: 'Elite',
  master: 'Master',
};

/**
 * A named location or NPC that can be the answer to a step.
 *
 * This is the solver's dictionary. Its size, not the number of catalogued
 * steps, is what bounds anagram and cipher coverage — so adding a name here is
 * the cheapest possible contribution and worth more than adding one step.
 *
 * `location` is optional on purpose. A wrong location is worse than an absent
 * one: it sends a member across the map. Leave it out unless you are sure, and
 * the UI will say so rather than guess.
 */
export interface ClueTarget {
  /** Exactly as the game spells it, including apostrophes and capitalisation. */
  name: string;
  /** Where to find them. Omit rather than guess. */
  location?: string;
  /** Wiki page title, so a member can check us. Defaults to `name`. */
  wikiPage?: string;
}

/**
 * One catalogued step.
 *
 * `id` is stable and referenced by nothing else yet, but a URL like
 * `/clues/solver?step=anagram-an-earl` is the obvious next feature and renaming
 * ids later would break shared links.
 */
export interface ClueStep {
  id: string;
  type: ClueType;
  /** Tiers this step is known to appear in. A step can appear in several. */
  tiers: readonly ClueTier[];
  /** The text as it reads on the scroll. */
  clue: string;
  /** The NPC, object or place that answers it. */
  answer: string;
  /** What to actually do once you are there. */
  solution: string;
  /** Wiki page a member can verify this against. */
  wikiPage: string;
}
