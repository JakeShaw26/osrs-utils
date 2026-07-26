import type { Metadata } from 'next';
import { FeatureCard } from '@/components/organisms/FeatureCard';
import { CoverageNotice } from '@/components/molecules/clues/CoverageNotice';
import { clueCoverage } from '@/lib/clues/coverage';

export const metadata: Metadata = {
  title: 'Clues & Collection',
  description:
    'Clue scroll solver, Combat Achievement tracker and collection log status for Void Reavers.',
};

/**
 * PAGE — the Clues & Collection index.
 *
 * A server component with no data fetching: everything below is either a
 * compile-time constant or a count derived from one. That is why this route
 * builds with an empty `.env.local` and why it costs no upstream request.
 */
export default function CluesPage() {
  const coverage = clueCoverage();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-content sm:text-3xl">
          Clues &amp; Collection
        </h1>
        <p className="mt-2 max-w-2xl text-content-muted">
          Treasure Trails tools. Two of the three things people ask for here are limited
          by what data actually exists rather than by effort, and each page says which.
        </p>
      </header>

      <div className="mb-8 grid gap-3 sm:grid-cols-2">
        <FeatureCard
          title="Clue scroll solver"
          description="Search a partial step catalogue, and solve any anagram or cipher whose answer is in our name index."
          href="/clues/solver"
        />
        <FeatureCard
          title="Combat Achievement tracker"
          description="The full task list from the OSRS Wiki. Completion is yours to tick, stored only in this browser."
          href="/clues/combat-achievements"
        />
        <FeatureCard
          title="Collection log"
          description="Why we cannot show per-player collection log data yet — and what would have to change."
          href="/clues/collection-log"
        />
      </div>

      <CoverageNotice coverage={coverage} />
    </main>
  );
}
