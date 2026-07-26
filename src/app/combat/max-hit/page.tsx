import type { Metadata } from 'next';
import { MaxHitCalculator } from '@/components/organisms/combat/MaxHitCalculator';
import { CalculatorLayout } from '@/components/templates/CalculatorLayout';

export const metadata: Metadata = {
  title: 'Maximum hit calculator',
  description:
    'Melee, ranged and magic maximum hit, from the OSRS Wiki’s published combat formulas.',
};

/**
 * PAGE — stays a server component. `"use client"` lives on `MaxHitCalculator`,
 * the smallest leaf that needs state.
 */
export default function MaxHitPage() {
  return (
    <CalculatorLayout
      title="Maximum hit"
      description="The damage half of the combat maths, for all three styles. Nothing here needs a network request."
      notes={
        <ul className="list-disc space-y-1 pl-4">
          <li>
            Formulas are implemented in-house from the OSRS Wiki’s documented combat maths
            — <em>Maximum melee hit</em>, <em>Maximum ranged hit</em>,{' '}
            <em>Maximum magic hit</em> and the <em>Damage per second</em> pages, read 26
            July 2026. No third-party calculator source is used (ADR-0007).
          </li>
          <li>
            Where the wiki’s own pages disagree on the order of operations, we follow the
            DPS pages, which reproduce the wiki’s published free-to-play maximum hit of 31
            exactly. That case is pinned as a test.
          </li>
          <li>
            <strong>Not modelled:</strong> special attacks, Twisted bow and Tumeken’s
            shadow scaling, bolt procs, elemental weakness, Inquisitor’s, obsidian and
            Berserker necklace, and Augury’s magic damage. A max hit shown here is the
            baseline for the gear and boosts you selected.
          </li>
          <li>Damage is capped at 200, as it is in game.</li>
        </ul>
      }
    >
      <MaxHitCalculator />
    </CalculatorLayout>
  );
}
