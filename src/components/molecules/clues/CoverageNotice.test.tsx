import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CoverageNotice } from './CoverageNotice';
import type { ClueCoverage } from '@/lib/clues/coverage';

/**
 * This panel is the feature's honesty contract, so the tests are about what it
 * *says*, not how it looks. A partial dataset that does not announce itself is
 * indistinguishable from a broken complete one.
 */
const COVERAGE: ClueCoverage = {
  totalSteps: 29,
  targetCount: 88,
  byType: [
    { type: 'anagram', catalogued: 18, derivable: true },
    { type: 'cipher', catalogued: 0, derivable: true },
    { type: 'cryptic', catalogued: 11, derivable: false },
    { type: 'emote', catalogued: 0, derivable: false },
  ],
  uncoveredTypes: ['emote'],
};

describe('CoverageNotice', () => {
  it('states the real numbers rather than a vague disclaimer', () => {
    render(<CoverageNotice coverage={COVERAGE} />);

    expect(screen.getByText('29')).toBeInTheDocument();
    expect(screen.getAllByText('88').length).toBeGreaterThan(0);
  });

  it('says the dataset is partial in as many words', () => {
    render(<CoverageNotice coverage={COVERAGE} />);

    expect(
      screen.getByText(/this is a deliberately partial dataset/i),
    ).toBeInTheDocument();
  });

  it('names the types with no coverage at all', () => {
    // So a member who searches an emote clue and finds nothing already knows
    // why, instead of concluding the tool does not work.
    render(<CoverageNotice coverage={COVERAGE} />);

    expect(screen.getByText(/not covered at all yet/i)).toBeInTheDocument();
    expect(screen.getByText(/our gap, not a\s+non-existent clue/i)).toBeInTheDocument();
  });

  it('explains that anagrams and ciphers are not limited by the step count', () => {
    // The counterintuitive part: cipher shows 0 catalogued but has full
    // algorithmic coverage over the name index.
    render(<CoverageNotice coverage={COVERAGE} />);

    expect(screen.getByText(/solved by algorithm/i)).toBeInTheDocument();
  });

  it('omits the uncovered-types paragraph when everything is covered', () => {
    render(<CoverageNotice coverage={{ ...COVERAGE, uncoveredTypes: [] }} />);

    expect(screen.queryByText(/not covered at all yet/i)).toBeNull();
  });
});
