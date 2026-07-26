import { StatBadge } from '@/components/atoms/StatBadge';
import { wikiUrlFor } from '@/lib/clues/npc-index';
import { CLUE_TIER_LABELS, CLUE_TYPE_LABELS, type ClueStep } from '@/lib/clues/types';

/**
 * MOLECULE — one catalogued clue step.
 *
 * The wiki link is not a courtesy, it is the correctness story for this whole
 * feature. Our steps are hand-authored and therefore fallible, and the Wiki's
 * content is CC BY-NC-SA — attribution is required where we display data
 * derived from it (docs/api-terms.md §2). Linking the page discharges the
 * licence obligation and gives a member a way to check us in one click.
 */
export function ClueStepCard({ step }: { step: ClueStep }) {
  return (
    <article className="rounded-card border border-border bg-surface-raised p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <StatBadge value={CLUE_TYPE_LABELS[step.type]} tone="info" />
        {step.tiers.map((tier) => (
          <StatBadge key={tier} value={CLUE_TIER_LABELS[tier]} />
        ))}
      </div>

      <p className="mt-3 font-mono text-sm text-content">{step.clue}</p>

      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="text-content-subtle">Answer</dt>
          <dd className="font-medium text-content">{step.answer}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-content-subtle">Do</dt>
          <dd className="text-content-muted">{step.solution}</dd>
        </div>
      </dl>

      <a
        href={wikiUrlFor(step.wikiPage)}
        rel="noreferrer noopener"
        target="_blank"
        className="mt-3 inline-block text-sm text-primary hover:underline"
      >
        Check on the OSRS Wiki
      </a>
    </article>
  );
}
