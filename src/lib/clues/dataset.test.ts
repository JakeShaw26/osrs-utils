import { describe, expect, it } from 'vitest';
import { anagramKey } from './anagram';
import { clueCoverage } from './coverage';
import { CLUE_STEPS, UNCOVERED_CLUE_TYPES } from './dataset';
import { normaliseForSearch } from './normalise';
import { CLUE_TARGETS } from './npc-index';
import { CLUE_TIERS, CLUE_TYPES } from './types';

/**
 * Integrity tests for hand-authored data.
 *
 * These are the highest-value tests in this feature and they are not really
 * "unit tests" — they are a proofreader. Every entry in `dataset.ts` and
 * `npc-index.ts` was typed by a human, and the failure mode of typed game data
 * is not a crash, it is a wrong answer delivered confidently. A member who runs
 * to the wrong city has no way to tell our mistake from their own misreading.
 *
 * The anagram check below is the sharpest of them: because an anagram clue is
 * *provably* a rearrangement of its answer, a mistyped clue or answer is
 * detectable mechanically. That turns proofreading into a build step.
 */

describe('clue dataset integrity', () => {
  it('has no duplicate step ids', () => {
    // Ids are stable deep-link candidates; a duplicate would make one of two
    // different steps unreachable.
    const ids = CLUE_STEPS.map((step) => step.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every step all of its required fields', () => {
    for (const step of CLUE_STEPS) {
      expect(step.id, `${step.id}: id`).not.toBe('');
      expect(step.clue.trim(), `${step.id}: clue`).not.toBe('');
      expect(step.answer.trim(), `${step.id}: answer`).not.toBe('');
      expect(step.solution.trim(), `${step.id}: solution`).not.toBe('');
      expect(step.wikiPage.trim(), `${step.id}: wikiPage`).not.toBe('');
      expect(step.tiers.length, `${step.id}: tiers`).toBeGreaterThan(0);
    }
  });

  it('uses only known types and tiers', () => {
    for (const step of CLUE_STEPS) {
      expect(CLUE_TYPES, `${step.id}: type`).toContain(step.type);
      for (const tier of step.tiers) {
        expect(CLUE_TIERS, `${step.id}: tier`).toContain(tier);
      }
    }
  });

  it('proves every anagram clue really is its answer rearranged', () => {
    // A typo in either field fails here rather than shipping. This is the
    // reason anagram steps are worth cataloguing at all despite being solvable
    // without the catalogue: they are self-verifying.
    for (const step of CLUE_STEPS.filter((s) => s.type === 'anagram')) {
      expect(
        anagramKey(step.clue),
        `${step.id}: "${step.clue}" vs "${step.answer}"`,
      ).toBe(anagramKey(step.answer));
    }
  });

  it('keeps every derivable step’s answer inside the solver index', () => {
    // If an anagram's answer is missing from the index, the solver silently
    // cannot solve it even though it is catalogued — a gap nobody would notice.
    const names = new Set(CLUE_TARGETS.map((target) => normaliseForSearch(target.name)));

    for (const step of CLUE_STEPS.filter(
      (s) => s.type === 'anagram' || s.type === 'cipher',
    )) {
      expect(names, `${step.id}: "${step.answer}" is not in npc-index.ts`).toContain(
        normaliseForSearch(step.answer),
      );
    }
  });

  it('has no duplicate names in the solver index', () => {
    const names = CLUE_TARGETS.map((target) => normaliseForSearch(target.name));

    expect(new Set(names).size).toBe(names.length);
  });

  it('gives every indexed name a non-empty spelling', () => {
    for (const target of CLUE_TARGETS) {
      expect(target.name.trim()).not.toBe('');
      // `location` is optional by design — absent beats wrong — but an empty
      // string is neither, and would render as a blank line.
      if (target.location !== undefined) expect(target.location.trim()).not.toBe('');
    }
  });
});

describe('clueCoverage', () => {
  it('counts what is actually in the dataset', () => {
    const coverage = clueCoverage();

    expect(coverage.totalSteps).toBe(CLUE_STEPS.length);
    expect(coverage.targetCount).toBe(CLUE_TARGETS.length);
  });

  it('agrees with the dataset about which types are uncovered', () => {
    // The UI states these as "not covered at all". If a step of that type were
    // added without updating the list, the page would start lying.
    const coverage = clueCoverage();

    for (const type of UNCOVERED_CLUE_TYPES) {
      const entry = coverage.byType.find((item) => item.type === type);
      expect(entry?.catalogued, `${type} is listed as uncovered`).toBe(0);
      expect(entry?.derivable, `${type} is listed as uncovered`).toBe(false);
    }
  });

  it('marks anagram and cipher as derivable, because coverage there is not the step count', () => {
    const coverage = clueCoverage();
    const derivable = coverage.byType
      .filter((entry) => entry.derivable)
      .map((e) => e.type);

    expect(derivable).toEqual(['anagram', 'cipher']);
  });

  it('ships a non-trivial amount of data', () => {
    // A guard against the dataset being accidentally emptied by a bad merge —
    // which would leave every page rendering a perfectly-worded empty state.
    const coverage = clueCoverage();

    expect(coverage.totalSteps).toBeGreaterThan(20);
    expect(coverage.targetCount).toBeGreaterThan(50);
  });
});
