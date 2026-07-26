import type { Metadata } from 'next';
import { CalculatorLayout } from '@/components/templates/CalculatorLayout';
import { ResetTracker } from '@/components/organisms/utility/ResetTracker';

export const metadata: Metadata = {
  title: 'Reset tracker',
  description: 'Countdowns to the daily, weekly and monthly OSRS resets.',
};

/**
 * PAGE — reset countdowns.
 *
 * Stays a server component. `ResetTracker` carries the "use client" directive
 * because a live clock needs one; hoisting it here would pull the layout and
 * every atom on the page into the browser bundle for no benefit.
 */
export default function ResetsPage() {
  return (
    <CalculatorLayout
      title="Reset tracker"
      description="The game resets on UTC. Your device is probably not on UTC. Both are shown."
      notes={
        <ul className="grid gap-2">
          <li>
            All countdowns are computed in UTC and converted for display, so they stay
            correct across the BST changeover in March and October. The number of seconds
            remaining is the same wherever you are; only the wall-clock time of the reset
            differs.
          </li>
          <li>
            Reset times are transcribed from the OSRS Wiki, not read from an API — none
            exists. Each card states where its rule came from, and anything we are not
            certain of is badged rather than presented as fact.
          </li>
          <li>
            The countdown runs off your device&apos;s clock. If that is wrong, so is this.
          </li>
        </ul>
      }
    >
      <ResetTracker />
    </CalculatorLayout>
  );
}
