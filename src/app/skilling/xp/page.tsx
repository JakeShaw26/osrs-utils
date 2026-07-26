import type { Metadata } from 'next';
import { CalculatorLayout } from '@/components/templates/CalculatorLayout';
import { XpCalculator } from '@/components/organisms/skilling/XpCalculator';
import { MAX_XP, XP_AT_MAX_LEVEL } from '@/lib/skilling/xp-table';

/**
 * A SERVER component hosting one client island. There is no `"use client"` here
 * and there must not be — the directive belongs on `XpCalculator`, the smallest
 * thing that needs state.
 *
 * Nothing on this page fetches. The XP table is a game constant, so this route
 * is fully static and works with no network, no database and no secrets.
 */
export const metadata: Metadata = {
  title: 'XP calculator',
  description:
    'Work out XP remaining and actions required between any two OSRS levels or XP totals.',
};

export default function XpCalculatorPage() {
  return (
    <CalculatorLayout
      title="XP calculator"
      description="How much XP is left, and how many actions that is."
      notes={
        <ul className="list-disc space-y-1 pl-4">
          <li>
            The XP table is a game constant with no API. It is authored in-repo and
            checked against the published formula in CI.
          </li>
          <li>
            Level 99 is{' '}
            <span className="tabular">{XP_AT_MAX_LEVEL.toLocaleString('en-GB')}</span> XP,
            but the ceiling is{' '}
            <span className="tabular">{MAX_XP.toLocaleString('en-GB')}</span>. Switch the
            target to XP to plan past 99.
          </li>
          <li>
            Action counts always round <strong>up</strong> — you cannot do part of an
            action.
          </li>
          <li>
            The hiscores lookup is optional and cached for five minutes per name. A player
            who is not listed is a normal result, not a failure.
          </li>
        </ul>
      }
    >
      <XpCalculator />
    </CalculatorLayout>
  );
}
