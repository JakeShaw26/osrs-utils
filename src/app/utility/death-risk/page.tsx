import type { Metadata } from 'next';
import { CalculatorLayout } from '@/components/templates/CalculatorLayout';
import { DeathRiskCalculator } from '@/components/organisms/utility/DeathRiskCalculator';
import { DEATH_RULE_CLAUSES } from '@/lib/utility/death-risk';
import { fetchWildernessItemCatalogue } from '@/lib/utility/item-prices';

export const metadata: Metadata = {
  title: 'Wilderness death risk',
  description:
    'Items kept on death, and what the rest is worth at live Grand Exchange prices.',
};

/**
 * PAGE — wilderness death risk.
 *
 * Fetches here and passes down, per the layering rules. The fetch is two bulk
 * requests behind `osrsFetch`'s cache and is shared by every visitor, so there
 * is no per-request upstream call to rate limit — which is the first line of
 * defence, not the third (ADR-0013).
 */

/**
 * Hourly ISR, set on the page rather than left to the fetch's own TTL.
 *
 * If the build runs without secrets — which CI does deliberately —
 * `fetchWildernessItemCatalogue` degrades before it ever reaches `osrsFetch`,
 * so no revalidation tag is registered and the page would otherwise be frozen
 * in its price-less state forever. A page-level revalidate guarantees it
 * recovers on its own once the environment is configured.
 */
export const revalidate = 3600;

export default async function DeathRiskPage() {
  const catalogue = await fetchWildernessItemCatalogue();

  return (
    <CalculatorLayout
      title="Wilderness death risk"
      description="How much of what you are carrying survives, and what the rest costs you."
      notes={
        <div className="grid gap-3">
          <ul className="grid gap-2">
            {DEATH_RULE_CLAUSES.map((clause) => (
              <li key={clause.id}>
                {clause.statement}{' '}
                <span className="text-content-subtle">({clause.source})</span>
              </li>
            ))}
          </ul>

          <p>
            <strong>Not modelled:</strong> reclaim costs at Death&apos;s Office, what a
            killer actually receives, item-specific exceptions and the Ultimate Ironman
            case. Those are stated here rather than approximated, because a confident
            wrong number is worse than a missing one.
          </p>

          {catalogue.missing.length > 0 ? (
            <p className="text-warning">
              Not found in the price list — likely renamed: {catalogue.missing.join(', ')}
            </p>
          ) : null}

          {catalogue.unpriced.length > 0 ? (
            <p className="text-warning">
              No current two-sided price, so left out rather than guessed:{' '}
              {catalogue.unpriced.join(', ')}
            </p>
          ) : null}
        </div>
      }
    >
      <DeathRiskCalculator catalogue={catalogue.items} pricesError={catalogue.error} />
    </CalculatorLayout>
  );
}
