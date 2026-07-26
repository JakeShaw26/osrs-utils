import { solveAnagram } from './anagram';
import { solveCipher, type CipherCandidate } from './cipher';
import { CLUE_STEPS } from './dataset';
import { matchesQuery } from './normalise';
import { CLUE_TARGETS } from './npc-index';
import type { ClueStep, ClueTarget, ClueType } from './types';

/**
 * The solver's entry point: one query, three ways of answering it.
 *
 * A player pastes a line of scroll text and does not know or care which
 * mechanism can answer it. So a search runs all three in parallel:
 *
 *  1. **Catalogued steps** — substring match over the clue text, the answer and
 *     the solution, so `"party"`, `"falador"` and `"peaty"` all reach the same
 *     step.
 *  2. **Anagram solving** — over the name index, so an anagram nobody has
 *     catalogued still resolves.
 *  3. **Cipher decoding** — likewise, by brute-forcing all 25 rotations.
 *
 * 2 and 3 are why a miss here means "not in our index", not "no such clue", and
 * why `ClueSearchResult` reports them separately rather than merging everything
 * into one list. The UI has to be able to say which kind of nothing it found.
 */

export type ClueTypeFilter = ClueType | 'all';

export interface ClueSearchResult {
  /** The query as typed, so a caller can quote it back in the empty state. */
  query: string;
  /** Catalogued steps whose text matched. */
  steps: readonly ClueStep[];
  /** Names whose letters are an exact rearrangement of the query. */
  anagrams: readonly ClueTarget[];
  /** Caesar decodes of the query that landed on a catalogued name. */
  ciphers: readonly CipherCandidate[];
  /** True when nothing at all matched — the state the UI must explain. */
  isEmpty: boolean;
}

export interface ClueSearchOptions {
  type?: ClueTypeFilter;
  steps?: readonly ClueStep[];
  targets?: readonly ClueTarget[];
}

/** Fields worth matching against. Deliberately includes the solution prose, so
 * a location the player half-remembers ("keldagrim") finds the step. */
function stepMatches(step: ClueStep, query: string): boolean {
  return (
    matchesQuery(step.clue, query) ||
    matchesQuery(step.answer, query) ||
    matchesQuery(step.solution, query)
  );
}

export function searchClues(
  query: string,
  options: ClueSearchOptions = {},
): ClueSearchResult {
  const { type = 'all', steps: allSteps = CLUE_STEPS, targets = CLUE_TARGETS } = options;

  const trimmed = query.trim();
  if (trimmed === '') {
    return { query: trimmed, steps: [], anagrams: [], ciphers: [], isEmpty: true };
  }

  const steps = allSteps.filter(
    (step) => (type === 'all' || step.type === type) && stepMatches(step, trimmed),
  );

  // The derivable solvers only run when their type is in scope. Running the
  // anagram solver under a "cryptic" filter would surface a result the filter
  // says is excluded, which reads as a bug even when the answer is right.
  const anagrams =
    type === 'all' || type === 'anagram' ? solveAnagram(trimmed, targets) : [];
  const ciphers =
    type === 'all' || type === 'cipher' ? solveCipher(trimmed, targets) : [];

  return {
    query: trimmed,
    steps,
    anagrams,
    ciphers,
    isEmpty: steps.length === 0 && anagrams.length === 0 && ciphers.length === 0,
  };
}
