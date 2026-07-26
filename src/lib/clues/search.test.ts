import { describe, expect, it } from 'vitest';
import { searchClues } from './search';
import { lettersOnly, matchesQuery, normaliseForSearch } from './normalise';
import { caesarShift } from './cipher';
import type { ClueStep, ClueTarget } from './types';

const TARGETS: readonly ClueTarget[] = [
  { name: 'Party Pete', location: 'Falador Party Room' },
  { name: 'Bartender' },
];

const STEPS: readonly ClueStep[] = [
  {
    id: 'anagram-peaty-pert',
    type: 'anagram',
    tiers: ['easy'],
    clue: 'PEATY PERT',
    answer: 'Party Pete',
    solution: 'Talk to Party Pete in the Falador Party Room.',
    wikiPage: 'Party Pete',
  },
  {
    id: 'cryptic-rusty-anchor',
    type: 'cryptic',
    tiers: ['easy'],
    clue: 'Speak to the bartender of the Rusty Anchor in Port Sarim.',
    answer: 'Bartender',
    solution: 'The Rusty Anchor is in the north of Port Sarim.',
    wikiPage: 'Rusty Anchor',
  },
];

const options = { steps: STEPS, targets: TARGETS };

describe('normalisation', () => {
  it('deletes apostrophes but treats other punctuation as a word break', () => {
    // An apostrophe is inside a word and a hyphen is between two, so they
    // cannot be handled the same way. Players type "wydins food", never
    // "wydin s food".
    expect(normaliseForSearch("Wydin's Food Store")).toBe('wydins food store');
    expect(normaliseForSearch('Wydin’s Food Store')).toBe('wydins food store');
    expect(normaliseForSearch('Ur-tag')).toBe('ur tag');
  });

  it('lettersOnly discards spacing entirely', () => {
    expect(lettersOnly("Wydin's Food Store")).toBe('wydinsfoodstore');
  });

  it('matches partially and case-insensitively', () => {
    // Players type fragments. A prefix-only or whole-word match would miss most
    // real queries.
    expect(matchesQuery('Zoo keeper', 'zoo')).toBe(true);
    expect(matchesQuery('Zoo keeper', 'KEEPER')).toBe(true);
    expect(matchesQuery("Wydin's Food Store", 'wydins food')).toBe(true);
  });

  it('never matches on an empty needle', () => {
    // Otherwise every entry "matches" a blank box and the page floods.
    expect(matchesQuery('anything', '')).toBe(false);
    expect(matchesQuery('anything', '   ')).toBe(false);
  });
});

describe('searchClues', () => {
  it('finds a catalogued step by its clue text', () => {
    expect(searchClues('PEATY', options).steps.map((s) => s.id)).toEqual([
      'anagram-peaty-pert',
    ]);
  });

  it('finds a step by its answer or by prose in its solution', () => {
    // "falador" appears only in the solution — a player half-remembering where
    // to go should still land on the step.
    expect(searchClues('falador', options).steps.map((s) => s.id)).toEqual([
      'anagram-peaty-pert',
    ]);
    expect(searchClues('party pete', options).steps.map((s) => s.id)).toEqual([
      'anagram-peaty-pert',
    ]);
  });

  it('handles apostrophes in the query without dropping the match', () => {
    expect(searchClues('rusty anchor', options).steps.map((s) => s.id)).toEqual([
      'cryptic-rusty-anchor',
    ]);
  });

  it('solves an anagram that is not in the step catalogue', () => {
    // The point of the derivable types: coverage from the name index, not from
    // anyone transcribing steps.
    const result = searchClues('TYPE PARTE', { ...options, steps: [] });

    expect(result.anagrams.map((t) => t.name)).toEqual(['Party Pete']);
    expect(result.isEmpty).toBe(false);
  });

  it('decodes a cipher that is not in the step catalogue', () => {
    const result = searchClues(caesarShift('Bartender', 9), { ...options, steps: [] });

    expect(result.ciphers.map((c) => c.target?.name)).toEqual(['Bartender']);
  });

  it('does not run the anagram solver when the filter excludes anagrams', () => {
    // Surfacing a result the active filter says is excluded reads as a bug even
    // when the answer is correct.
    const result = searchClues('TYPE PARTE', { ...options, type: 'cryptic' });

    expect(result.anagrams).toEqual([]);
    expect(result.isEmpty).toBe(true);
  });

  it('restricts catalogued steps to the selected type', () => {
    const result = searchClues('a', { ...options, type: 'cryptic' });

    expect(result.steps.every((step) => step.type === 'cryptic')).toBe(true);
  });

  it('reports an empty query as empty rather than matching everything', () => {
    const result = searchClues('   ', options);

    expect(result.isEmpty).toBe(true);
    expect(result.steps).toEqual([]);
  });

  it('reports a genuine miss as empty', () => {
    const result = searchClues('zzzzzzzz', options);

    expect(result.isEmpty).toBe(true);
    expect(result.query).toBe('zzzzzzzz');
  });
});
