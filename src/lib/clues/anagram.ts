import { lettersOnly } from './normalise';
import { CLUE_TARGETS } from './npc-index';
import type { ClueTarget } from './types';

/**
 * Anagram solving by letter multiset.
 *
 * An anagram clue is the answer's letters, rearranged and re-spaced. So the
 * canonical form of `"PEATY PERT"` and of `"Party Pete"` is the same string,
 * and solving reduces to a dictionary lookup rather than a search. That is the
 * whole reason anagram coverage does not require anyone to catalogue anagrams:
 * it requires only that the answer is in the name index.
 *
 * Spacing carries no information and is discarded — the game moves the spaces
 * around precisely to obscure the word boundaries.
 */

/**
 * Canonical form: the string's letters, lowercased and sorted.
 *
 * Sorting rather than counting because the key has to be usable as a `Map` key,
 * and a sorted string is both hashable and trivially inspectable in a failing
 * test.
 */
export function anagramKey(value: string): string {
  return lettersOnly(value).split('').sort().join('');
}

/** Index built once at module load — the target list is a compile-time constant. */
function buildIndex(targets: readonly ClueTarget[]): Map<string, ClueTarget[]> {
  const index = new Map<string, ClueTarget[]>();
  for (const target of targets) {
    const key = anagramKey(target.name);
    const bucket = index.get(key);
    if (bucket) bucket.push(target);
    else index.set(key, [target]);
  }
  return index;
}

const DEFAULT_INDEX = buildIndex(CLUE_TARGETS);

/**
 * Every catalogued name whose letters are exactly `text`'s letters.
 *
 * Returns an array, not a single result: distinct names can share a letter
 * multiset, and presenting one of several as *the* answer would be a confident
 * lie. Empty means "the answer is not in our index", which is a different
 * statement from "there is no such clue" and the UI must say so.
 *
 * A one-letter or empty input returns nothing rather than matching noise.
 */
export function solveAnagram(
  text: string,
  targets: readonly ClueTarget[] = CLUE_TARGETS,
): ClueTarget[] {
  const key = anagramKey(text);
  if (key.length < 2) return [];

  const index = targets === CLUE_TARGETS ? DEFAULT_INDEX : buildIndex(targets);
  const matches = index.get(key) ?? [];

  // An input identical to the answer is not an anagram of anything — it is the
  // answer. Returning it would make the solver look like it "solved" a name the
  // player already typed in full, which is worse than saying nothing.
  return matches.filter((target) => lettersOnly(target.name) !== lettersOnly(text));
}
