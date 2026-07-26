import { StatBadge } from '@/components/atoms/StatBadge';
import { CLUE_TYPE_LABELS } from '@/lib/clues/types';
import type { ClueCoverage } from '@/lib/clues/coverage';

/**
 * MOLECULE — states, in numbers, exactly how partial this dataset is.
 *
 * This is a product requirement rather than decoration. The full Treasure
 * Trails corpus is thousands of steps; we ship a fraction of it. Without this
 * panel a miss reads as "the tool is broken", and a member stops trusting the
 * hits as well as the misses. Saying the size up front converts an apparent
 * defect into a stated boundary.
 *
 * Every figure comes from `clueCoverage()`, which counts the data — so this
 * cannot drift out of date the way a hardcoded sentence would.
 *
 * A molecule: a handful of `StatBadge` atoms doing one job, no data fetching.
 */
export function CoverageNotice({ coverage }: { coverage: ClueCoverage }) {
  const derivable = coverage.byType.filter((entry) => entry.derivable);
  const authored = coverage.byType.filter(
    (entry) => !entry.derivable && entry.catalogued > 0,
  );

  return (
    <section
      aria-labelledby="clue-coverage-heading"
      className="rounded-card border border-border bg-surface-sunken p-4"
    >
      <h2
        id="clue-coverage-heading"
        className="text-2xs font-semibold tracking-wide text-content-subtle uppercase"
      >
        What this dataset covers
      </h2>

      <div className="mt-3 flex flex-wrap gap-2">
        <StatBadge label="Catalogued steps" value={coverage.totalSteps} tone="info" />
        <StatBadge
          label="Names in solver index"
          value={coverage.targetCount}
          tone="info"
        />
        {authored.map((entry) => (
          <StatBadge
            key={entry.type}
            label={CLUE_TYPE_LABELS[entry.type]}
            value={entry.catalogued}
          />
        ))}
      </div>

      <div className="mt-3 space-y-2 text-sm text-content-muted">
        <p>
          <strong className="text-content">
            This is a deliberately partial dataset.
          </strong>{' '}
          Old School RuneScape has thousands of clue steps across six tiers, and we have
          not measured the total — the Wiki exposes no clue dataset to count. What is
          stated above is what we actually hold.
        </p>

        <p>
          <strong className="text-content">
            {derivable.map((entry) => CLUE_TYPE_LABELS[entry.type]).join(' and ')} steps
            are solved by algorithm
          </strong>
          , not looked up, so they work for clues that appear nowhere in our catalogue —
          as long as the answer is one of the{' '}
          <span className="tabular">{coverage.targetCount}</span> names in the solver
          index.
        </p>

        {coverage.uncoveredTypes.length > 0 ? (
          <p>
            <strong className="text-content">Not covered at all yet:</strong>{' '}
            {coverage.uncoveredTypes.map((type) => CLUE_TYPE_LABELS[type]).join(', ')}. A
            search for one of those will find nothing — that is our gap, not a
            non-existent clue.
          </p>
        ) : null}
      </div>
    </section>
  );
}
