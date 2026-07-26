import type { Metadata } from 'next';
import { CalculatorLayout } from '@/components/templates/CalculatorLayout';
import { ConstructionCalculator } from '@/components/organisms/skilling/ConstructionCalculator';
import {
  CONSTRUCTION_BUILDS,
  CONSTRUCTION_DATA_UPDATED,
  CONSTRUCTION_DATA_VERSION,
  CONSTRUCTION_SOURCE,
  constructionItemNames,
} from '@/lib/skilling/construction';
import { fetchPricesForItems } from '@/lib/skilling/pricing';

export const metadata: Metadata = {
  title: 'Construction cost calculator',
  description:
    'Turn a Construction XP goal into a priced plank shopping list, using live Grand Exchange prices.',
};

/** Live prices — see the note in ../methods/page.tsx for why this is dynamic. */
export const dynamic = 'force-dynamic';

export default async function ConstructionPage() {
  const lookup = await fetchPricesForItems(constructionItemNames());

  return (
    <CalculatorLayout
      title="Construction costs"
      description="How many planks, and what they will cost."
      notes={
        <ul className="list-disc space-y-1 pl-4">
          <li>
            Material lists, XP per build and level requirements are game constants. xp/hr
            is an estimate assuming a butler and an uninterrupted build-remove cycle. Data
            version <span className="tabular">{CONSTRUCTION_DATA_VERSION}</span>, updated{' '}
            {CONSTRUCTION_DATA_UPDATED} from{' '}
            <a
              href={CONSTRUCTION_SOURCE.url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-info underline underline-offset-2"
            >
              {CONSTRUCTION_SOURCE.title}
            </a>
            .
          </li>
          <li>
            Costs use the Grand Exchange price of the <em>finished plank</em>. Buying logs
            and paying the sawmill operator is usually cheaper and is not modelled here.
          </li>
          <li>
            Nail counts are the nominal figure. Nails bend in practice, so bring extra.
          </li>
          <li>
            Butler and demon butler fees, and the cost of the house itself, are excluded.
          </li>
        </ul>
      }
    >
      <ConstructionCalculator
        builds={CONSTRUCTION_BUILDS}
        prices={lookup.prices}
        pricesUnavailable={lookup.unavailable}
      />
    </CalculatorLayout>
  );
}
