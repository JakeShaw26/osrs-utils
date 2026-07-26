import { normaliseForSearch } from './normalise';
import { CLUE_TARGETS } from './npc-index';
import type { ClueTarget } from './types';

/**
 * Caesar-cipher decoding for cipher clue scrolls.
 *
 * A cipher clue is a name with every letter rotated by a fixed amount, so the
 * decode space is 25 candidates and can simply be enumerated. Like the anagram
 * solver, this means cipher coverage depends on the name index rather than on
 * anyone transcribing cipher texts — we can answer a cipher we have never seen.
 *
 * Non-letters are passed through untouched, which matters: the game preserves
 * spaces, hyphens and apostrophes in the ciphertext, and those are the strongest
 * hint about the shape of the answer.
 */

const ALPHABET_LENGTH = 26;
const LOWER_A = 'a'.charCodeAt(0);
const UPPER_A = 'A'.charCodeAt(0);

/**
 * Rotates letters forward by `shift`. Negative and >26 shifts are normalised,
 * so `caesarShift(x, -1)` and `caesarShift(x, 25)` agree.
 */
export function caesarShift(text: string, shift: number): string {
  if (!Number.isInteger(shift)) {
    throw new TypeError(`Caesar shift must be an integer, got ${shift}`);
  }

  const rotation = ((shift % ALPHABET_LENGTH) + ALPHABET_LENGTH) % ALPHABET_LENGTH;
  if (rotation === 0) return text;

  let out = '';
  for (const character of text) {
    const code = character.charCodeAt(0);
    if (character >= 'a' && character <= 'z') {
      out += String.fromCharCode(
        ((code - LOWER_A + rotation) % ALPHABET_LENGTH) + LOWER_A,
      );
    } else if (character >= 'A' && character <= 'Z') {
      out += String.fromCharCode(
        ((code - UPPER_A + rotation) % ALPHABET_LENGTH) + UPPER_A,
      );
    } else {
      out += character;
    }
  }
  return out;
}

export interface CipherCandidate {
  /** How far the ciphertext was rotated to produce `plaintext`. 1–25. */
  shift: number;
  /** The decoded text, with the original spacing and punctuation preserved. */
  plaintext: string;
  /** The index entry this decode matched, if any. */
  target?: ClueTarget;
}

/**
 * All 25 non-identity decodes, most plausible first.
 *
 * Decodes matching a catalogued name are returned first because they are the
 * answer; the rest follow so a player with a cipher whose answer is missing from
 * our index can still read the shifts themselves and spot it. Returning only
 * matches would turn "our dictionary is incomplete" into "this tool is broken",
 * which is exactly the failure mode this feature is trying to avoid.
 */
export function decodeCipher(
  ciphertext: string,
  targets: readonly ClueTarget[] = CLUE_TARGETS,
): CipherCandidate[] {
  const byName = new Map(
    targets.map((target) => [normaliseForSearch(target.name), target] as const),
  );

  const candidates: CipherCandidate[] = [];
  for (let shift = 1; shift < ALPHABET_LENGTH; shift += 1) {
    const plaintext = caesarShift(ciphertext, shift);
    candidates.push({
      shift,
      plaintext,
      target: byName.get(normaliseForSearch(plaintext)),
    });
  }

  return candidates.sort((a, b) => Number(Boolean(b.target)) - Number(Boolean(a.target)));
}

/** Just the decodes that landed on a catalogued name. */
export function solveCipher(
  ciphertext: string,
  targets: readonly ClueTarget[] = CLUE_TARGETS,
): CipherCandidate[] {
  if (ciphertext.trim() === '') return [];
  return decodeCipher(ciphertext, targets).filter((candidate) => candidate.target);
}
