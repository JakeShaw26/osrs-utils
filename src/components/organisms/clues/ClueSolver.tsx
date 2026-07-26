'use client';

import { useId, useMemo, useState } from 'react';
import { Input } from '@/components/atoms/Input';
import { Select } from '@/components/atoms/Select';
import { StatBadge } from '@/components/atoms/StatBadge';
import { ClueStepCard } from '@/components/molecules/clues/ClueStepCard';
import { wikiUrlFor } from '@/lib/clues/npc-index';
import { searchClues, type ClueTypeFilter } from '@/lib/clues/search';
import { CLUE_TYPES, CLUE_TYPE_LABELS } from '@/lib/clues/types';
import type { ClueCoverage } from '@/lib/clues/coverage';

/**
 * ORGANISM — the clue solver.
 *
 * `"use client"` sits here rather than on the page: the search is instant and
 * offline (the dataset is a compile-time constant, no request per keystroke),
 * so the page around it stays a server component.
 *
 * All matching lives in `@/lib/clues/search` — this file decides only what to
 * render. That split is what lets the punctuation, apostrophe and case-folding
 * behaviour be tested without a DOM, which is where the subtle bugs are.
 *
 * **The empty state is the most important thing in this component.** Our
 * dataset is a small fraction of the game's clue steps, so "no results" is a
 * likely and legitimate outcome, and it has to read as *we do not have this
 * one* rather than *no such clue exists*. Getting that wrong makes an honest
 * partial tool look like a broken complete one.
 */

/** The filter is a superset of ClueType, so build the options from the type. */
function typeOptions(coverage: ClueCoverage) {
  return [
    { value: 'all', label: 'All clue types' },
    ...CLUE_TYPES.map((type) => {
      const entry = coverage.byType.find((item) => item.type === type);
      const label = CLUE_TYPE_LABELS[type];

      if (entry?.derivable)
        return { value: type, label: `${label} — solved by algorithm` };
      if (entry && entry.catalogued > 0) {
        return { value: type, label: `${label} — ${entry.catalogued} catalogued` };
      }
      // Left selectable rather than disabled: a member who picks it gets an
      // explicit "not covered yet", which teaches them the boundary. A greyed
      // option just looks like a bug in the page.
      return { value: type, label: `${label} — not covered yet` };
    }),
  ];
}

export function ClueSolver({ coverage }: { coverage: ClueCoverage }) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState<ClueTypeFilter>('all');
  const searchId = useId();
  const filterId = useId();

  const result = useMemo(() => searchClues(query, { type }), [query, type]);
  const options = useMemo(() => typeOptions(coverage), [coverage]);

  const hasQuery = query.trim() !== '';
  const selectedTypeIsUncovered =
    type !== 'all' && coverage.uncoveredTypes.includes(type);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <div>
          <label
            htmlFor={searchId}
            className="mb-1 block text-sm font-medium text-content"
          >
            Clue text, anagram or cipher
          </label>
          <Input
            id={searchId}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g. PEATY PERT, or Rusty Anchor"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div>
          <label
            htmlFor={filterId}
            className="mb-1 block text-sm font-medium text-content"
          >
            Clue type
          </label>
          <Select
            id={filterId}
            options={options}
            value={type}
            onChange={(event) => setType(event.target.value as ClueTypeFilter)}
          />
        </div>
      </div>

      {selectedTypeIsUncovered ? (
        <p className="rounded-card border border-border bg-surface-sunken p-4 text-sm text-content-muted">
          We have no {CLUE_TYPE_LABELS[type].toLowerCase()} steps at all yet. Nothing you
          type here will match — this filter exists so the gap is visible rather than
          silent.
        </p>
      ) : null}

      {!hasQuery ? (
        <p className="text-sm text-content-muted">
          Type any part of a clue. Anagrams and ciphers are solved from the letters, so
          you can paste them exactly as the scroll writes them.
        </p>
      ) : null}

      {hasQuery && result.anagrams.length > 0 ? (
        <section aria-labelledby="anagram-results">
          <h3 id="anagram-results" className="mb-2 text-sm font-semibold text-content">
            Anagram solved
          </h3>
          <ul className="space-y-2">
            {result.anagrams.map((target) => (
              <li
                key={target.name}
                className="rounded-card border border-border bg-surface-raised p-4"
              >
                <p className="font-medium text-content">{target.name}</p>
                <p className="text-sm text-content-muted">
                  {target.location ?? 'Location not catalogued — check the Wiki page.'}
                </p>
                <a
                  href={wikiUrlFor(target.wikiPage ?? target.name)}
                  rel="noreferrer noopener"
                  target="_blank"
                  className="mt-2 inline-block text-sm text-primary hover:underline"
                >
                  Check on the OSRS Wiki
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {hasQuery && result.ciphers.length > 0 ? (
        <section aria-labelledby="cipher-results">
          <h3 id="cipher-results" className="mb-2 text-sm font-semibold text-content">
            Cipher decoded
          </h3>
          <ul className="space-y-2">
            {result.ciphers.map((candidate) => (
              <li
                key={candidate.shift}
                className="rounded-card border border-border bg-surface-raised p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-content">{candidate.plaintext}</p>
                  <StatBadge label="Shift" value={candidate.shift} />
                </div>
                <p className="text-sm text-content-muted">
                  {candidate.target?.location ??
                    'Location not catalogued — check the Wiki page.'}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {hasQuery && result.steps.length > 0 ? (
        <section aria-labelledby="step-results">
          <h3 id="step-results" className="mb-2 text-sm font-semibold text-content">
            Catalogued steps
          </h3>
          <ul className="space-y-3">
            {result.steps.map((step) => (
              <li key={step.id}>
                <ClueStepCard step={step} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {hasQuery && result.isEmpty ? (
        <section
          aria-labelledby="no-results"
          className="rounded-card border border-border bg-surface-sunken p-4"
        >
          <h3 id="no-results" className="text-sm font-semibold text-content">
            Not in our dataset
          </h3>
          <p className="mt-2 text-sm text-content-muted">
            Nothing here matches &ldquo;{result.query}&rdquo;. That almost certainly means
            we have not catalogued this step — we hold{' '}
            <span className="tabular">{coverage.totalSteps}</span> of the game&rsquo;s
            thousands, and <span className="tabular">{coverage.targetCount}</span> names
            in the anagram and cipher index. It is not a sign the clue does not exist.
          </p>
          <a
            href={`https://oldschool.runescape.wiki/w/Special:Search?search=${encodeURIComponent(result.query)}`}
            rel="noreferrer noopener"
            target="_blank"
            className="mt-2 inline-block text-sm text-primary hover:underline"
          >
            Search the OSRS Wiki for it
          </a>
        </section>
      ) : null}
    </div>
  );
}
