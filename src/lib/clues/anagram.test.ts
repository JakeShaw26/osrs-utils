import { describe, expect, it } from 'vitest';
import { anagramKey, solveAnagram } from './anagram';
import type { ClueTarget } from './types';

const TARGETS: readonly ClueTarget[] = [
  { name: 'Party Pete', location: 'Falador Party Room' },
  { name: 'Zoo keeper', location: 'Ardougne Zoo' },
  { name: "Wydin's Food Store" },
  { name: 'Ur-tag' },
  // Deliberate collision: "Silent" and "Listen" share a letter multiset, so a
  // single-result API would have to pick one and be wrong half the time.
  { name: 'Silent' },
  { name: 'Listen' },
];

describe('anagramKey', () => {
  it('is stable across case, spacing and punctuation', () => {
    expect(anagramKey('Party Pete')).toBe(anagramKey('PEATY PERT'));
    expect(anagramKey("Wydin's")).toBe(anagramKey('wy din s'));
  });

  it('ignores punctuation entirely, so apostrophes and hyphens do not shift a key', () => {
    // OSRS names are full of both. If punctuation reached the key, "Ur-tag"
    // would never match an anagram the game wrote without the hyphen.
    expect(anagramKey('Ur-tag')).toBe('agrtu');
    expect(anagramKey("Wydin's Food Store")).toBe(anagramKey('wydins food store'));
  });
});

describe('solveAnagram', () => {
  it('solves a real clue anagram', () => {
    expect(solveAnagram('PEATY PERT', TARGETS).map((t) => t.name)).toEqual([
      'Party Pete',
    ]);
  });

  it('is case-insensitive and ignores the clue’s spacing', () => {
    // The game moves the spaces specifically to hide word boundaries, so
    // spacing must carry no weight at all.
    expect(solveAnagram('peatypert', TARGETS).map((t) => t.name)).toEqual(['Party Pete']);
    expect(solveAnagram('p e a t y p e r t', TARGETS).map((t) => t.name)).toEqual([
      'Party Pete',
    ]);
  });

  it('returns every candidate when a letter multiset is ambiguous', () => {
    // Presenting one of two equally valid answers as "the" answer is a
    // confident lie, and the caller cannot detect it.
    expect(solveAnagram('Enlist', TARGETS).map((t) => t.name)).toEqual([
      'Silent',
      'Listen',
    ]);
  });

  it('returns nothing when the answer is not in the index', () => {
    // The state the UI has to explain: "not catalogued", not "no such clue".
    expect(solveAnagram('QQQQQQ', TARGETS)).toEqual([]);
  });

  it('does not treat a name typed in full as an anagram of itself', () => {
    expect(solveAnagram('Party Pete', TARGETS)).toEqual([]);
    expect(solveAnagram('party pete', TARGETS)).toEqual([]);
  });

  it('ignores inputs too short to be a clue', () => {
    expect(solveAnagram('', TARGETS)).toEqual([]);
    expect(solveAnagram('a', TARGETS)).toEqual([]);
    expect(solveAnagram('   ', TARGETS)).toEqual([]);
  });

  it('solves against the shipped index by default', () => {
    // Guards the wiring, not the algorithm: a caller passing no targets must
    // still get the real dictionary rather than an empty one.
    expect(solveAnagram('EEK ZERO OP').map((t) => t.name)).toEqual(['Zoo keeper']);
  });
});
