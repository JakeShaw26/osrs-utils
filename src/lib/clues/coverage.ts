import { CLUE_STEPS, UNCOVERED_CLUE_TYPES } from './dataset';
import { CLUE_TARGETS } from './npc-index';
import { CLUE_TYPES, DERIVABLE_CLUE_TYPES, type ClueType } from './types';

/**
 * Honest coverage figures, computed from the data rather than written down.
 *
 * The point of this module is that the numbers in the UI cannot go stale. A
 * hardcoded "60 clues covered" becomes a lie the first time someone adds a
 * step; deriving it means the claim is true by construction.
 *
 * Nothing here estimates the size of the *full* corpus. The wiki has no clue
 * bucket to count (verified 2026-07-26 — see ADR-0017), so any denominator we
 * printed would be a guess dressed up as a measurement. The UI says "thousands,
 * unmeasured" instead, which is the truth.
 */

export interface ClueTypeCoverage {
  type: ClueType;
  /** Steps catalogued in `dataset.ts`. */
  catalogued: number;
  /**
   * Whether a solver can answer this type without the step being catalogued.
   * When true, `catalogued` understates coverage — often by a lot.
   */
  derivable: boolean;
}

export interface ClueCoverage {
  totalSteps: number;
  /** Size of the solver dictionary — the real bound on anagram/cipher coverage. */
  targetCount: number;
  byType: readonly ClueTypeCoverage[];
  /** Types with neither catalogued steps nor a solver. */
  uncoveredTypes: readonly ClueType[];
}

export function clueCoverage(): ClueCoverage {
  const byType = CLUE_TYPES.map((type) => ({
    type,
    catalogued: CLUE_STEPS.filter((step) => step.type === type).length,
    derivable: DERIVABLE_CLUE_TYPES.includes(type),
  }));

  return {
    totalSteps: CLUE_STEPS.length,
    targetCount: CLUE_TARGETS.length,
    byType,
    uncoveredTypes: [...UNCOVERED_CLUE_TYPES],
  };
}
