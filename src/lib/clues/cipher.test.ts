import { describe, expect, it } from 'vitest';
import { caesarShift, decodeCipher, solveCipher } from './cipher';
import type { ClueTarget } from './types';

const TARGETS: readonly ClueTarget[] = [
  { name: 'Bartender', location: 'Any inn' },
  { name: 'Zoo keeper', location: 'Ardougne Zoo' },
  { name: "Wydin's Food Store" },
];

describe('caesarShift', () => {
  it('rotates letters and leaves everything else alone', () => {
    // Spacing, hyphens and apostrophes survive in the real ciphertexts and are
    // the strongest hint about the answer's shape — destroying them would make
    // the decoder less useful than reading the scroll.
    expect(caesarShift("Wydin's Food Store", 1)).toBe("Xzejo't Gppe Tupsf");
  });

  it('wraps around the end of the alphabet in both cases', () => {
    expect(caesarShift('zZ', 1)).toBe('aA');
    expect(caesarShift('aA', -1)).toBe('zZ');
  });

  it('treats negative and equivalent positive shifts identically', () => {
    expect(caesarShift('Bartender', -3)).toBe(caesarShift('Bartender', 23));
  });

  it('is a no-op at 0 and 26', () => {
    expect(caesarShift('Bartender', 0)).toBe('Bartender');
    expect(caesarShift('Bartender', 26)).toBe('Bartender');
  });

  it('rejects a non-integer shift rather than silently truncating it', () => {
    expect(() => caesarShift('Bartender', 1.5)).toThrow(TypeError);
  });
});

describe('decodeCipher', () => {
  it('returns all 25 non-identity rotations', () => {
    const candidates = decodeCipher('Ofsufoefs', TARGETS);

    expect(candidates).toHaveLength(25);
    expect(new Set(candidates.map((c) => c.shift)).size).toBe(25);
  });

  it('puts decodes that hit a catalogued name first', () => {
    // "Bartender" shifted forward by 13.
    const ciphertext = caesarShift('Bartender', 13);

    const best = decodeCipher(ciphertext, TARGETS)[0];

    expect(best?.plaintext).toBe('Bartender');
    expect(best?.target?.name).toBe('Bartender');
  });

  it('still returns every rotation when nothing matches, so the player can read them', () => {
    // Our dictionary being incomplete must not look like the tool being broken.
    const candidates = decodeCipher('Xyzzy', TARGETS);

    expect(candidates).toHaveLength(25);
    expect(candidates.every((c) => c.target === undefined)).toBe(true);
  });
});

describe('solveCipher', () => {
  it('returns only the decodes that landed on a name', () => {
    const solved = solveCipher(caesarShift('Zoo keeper', 7), TARGETS);

    expect(solved.map((c) => c.plaintext)).toEqual(['Zoo keeper']);
  });

  it('matches regardless of the case the player typed', () => {
    expect(
      solveCipher(caesarShift('BARTENDER', 4), TARGETS).map((c) => c.target?.name),
    ).toEqual(['Bartender']);
  });

  it('is empty for an empty query rather than returning 25 rotations of nothing', () => {
    expect(solveCipher('   ', TARGETS)).toEqual([]);
  });
});
