import type { Metadata } from 'next';
import { CalculatorLayout } from '@/components/templates/CalculatorLayout';
import { TrainingMethodComparator } from '@/components/organisms/skilling/TrainingMethodComparator';
import { fetchPricesForItems } from '@/lib/skilling/pricing';
import {
  requiredItemNames,
  TRAINING_METHODS,
  TRAINING_METHODS_UPDATED,
  TRAINING_METHODS_VERSION,
} from '@/lib/skilling/training-methods';

export const metadata: Metadata = {
  title: 'Training method comparator',
  description:
    'Compare OSRS training methods by xp/hr and gp/xp against live Grand Exchange prices.',
};

/**
 * WHY `force-dynamic`
 *
 * This page reads live prices. Without it, `next build` would try to prerender
 * the route, which means fetching the Grand Exchange during a build that runs
 * with no secrets and therefore no `OSRS_API_USER_AGENT` — CI would fail on a
 * page that is perfectly correct at runtime.
 *
 * `fetchPricesForItems` never throws, so even at runtime a dead upstream
 * degrades to "prices unavailable" rather than an error page. Both guards are
 * deliberate: one keeps the build green, the other keeps the tool usable.
 */
export const dynamic = 'force-dynamic';

export default async function TrainingMethodsPage() {
  const lookup = await fetchPricesForItems(requiredItemNames());

  return (
    <CalculatorLayout
      title="Training method comparator"
      description="xp/hr, gp/xp and total cost for a goal — with every rate open to argument."
      notes={
        <ul className="list-disc space-y-1 pl-4">
          <li>
            <strong>xp/hr figures are estimates, not facts.</strong> They assume an
            attentive player with reasonable gear and no interruptions. Every one is
            editable in the table — change it and the row recalculates from your number.
          </li>
          <li>
            Each row links the guide its rate came from and the date it was read. Rate
            data version <span className="tabular">{TRAINING_METHODS_VERSION}</span>,
            updated {TRAINING_METHODS_UPDATED}. Rates live in versioned JSON in the
            repository, so a change to them arrives as a reviewable pull request.
          </li>
          <li>
            gp/xp uses the live Grand Exchange mid price. A negative figure means the
            method makes money. Items with no usable price are named in the row rather
            than quietly costed at zero.
          </li>
          <li>
            Prices exclude the Grand Exchange tax and assume instant buys and sells at
            mid. Thin markets will not fill at these prices.
          </li>
        </ul>
      }
    >
      <TrainingMethodComparator
        methods={TRAINING_METHODS}
        prices={lookup.prices}
        pricesUnavailable={lookup.unavailable}
      />
    </CalculatorLayout>
  );
}
