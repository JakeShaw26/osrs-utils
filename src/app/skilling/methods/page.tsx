import type { Metadata } from 'next';
import { connection } from 'next/server';
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
 * WHY `connection()` AND `fetchCache`, RATHER THAN `force-dynamic`
 *
 * Two separate problems that look like one.
 *
 * 1. Keep the page out of `next build`. It reads live prices, so prerendering
 *    would fetch the Grand Exchange during a build that runs with no secrets
 *    and therefore no `OSRS_API_USER_AGENT` — CI fails on a page that is
 *    perfectly correct at runtime. `await connection()` defers the render to
 *    request time, which is all that is needed.
 *
 * 2. Keep the shared cache. `force-dynamic` also solved (1), but it is
 *    documented as equivalent to `fetchCache = 'force-no-store'`, which
 *    re-fetches "even if they provide a 'force-cache' option" — silently
 *    overriding the TTLs `osrsFetch` sets on `/mapping` (24h) and `/latest`
 *    (60s). That turns one shared upstream request per TTL into ~1MB from the
 *    Wiki on every single page load, by an anonymous public caller: the open
 *    proxy of hard rule #4 and PRD §5.3. `'default-cache'` honours each
 *    fetch's own option instead. (ADR-0014, and the same defect PR #8 fixed
 *    in Economy — this branch predates that fix.)
 *
 * `fetchPricesForItems` never throws, so a dead upstream still degrades to
 * "prices unavailable" rather than an error page.
 */
export const fetchCache = 'default-cache';

export default async function TrainingMethodsPage() {
  await connection();
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
