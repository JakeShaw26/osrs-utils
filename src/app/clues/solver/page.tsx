import type { Metadata } from 'next';
import { CalculatorLayout } from '@/components/templates/CalculatorLayout';
import { CoverageNotice } from '@/components/molecules/clues/CoverageNotice';
import { ClueSolver } from '@/components/organisms/clues/ClueSolver';
import { clueCoverage } from '@/lib/clues/coverage';

export const metadata: Metadata = {
  title: 'Clue scroll solver',
  description:
    'Search a partial clue step catalogue and solve anagrams and ciphers mechanically.',
};

/**
 * PAGE — the clue solver.
 *
 * Server component. It fetches nothing: the dataset is compiled into the
 * bundle, so the solver works offline, costs the Wiki no requests, and cannot
 * be turned into an open proxy. The one client island is `ClueSolver` itself.
 */
export default function ClueSolverPage() {
  const coverage = clueCoverage();

  return (
    <CalculatorLayout
      title="Clue scroll solver"
      description="Paste a line from a scroll. Anagrams and ciphers are solved from their letters; other step types are looked up in a catalogue we are still filling in."
      notes={
        <div className="space-y-2">
          <CoverageNotice coverage={coverage} />
          <p>
            Step text and NPC names are written from the public game and each carries a
            link to the OSRS Wiki page that confirms it. Wiki content is used under{' '}
            <a
              href="https://creativecommons.org/licenses/by-nc-sa/4.0/"
              rel="noreferrer noopener"
              target="_blank"
              className="text-primary hover:underline"
            >
              CC BY-NC-SA 4.0
            </a>
            . This site is not affiliated with Jagex.
          </p>
        </div>
      }
    >
      <ClueSolver coverage={coverage} />
    </CalculatorLayout>
  );
}
