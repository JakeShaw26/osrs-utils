import type { Metadata } from 'next';
import { DpsCalculator } from '@/components/organisms/combat/DpsCalculator';
import { CalculatorLayout } from '@/components/templates/CalculatorLayout';

export const metadata: Metadata = {
  title: 'DPS and gear comparison',
  description:
    'Compare loadouts against one monster using OSRS combat formulas and wiki equipment data.',
};

export default function DpsPage() {
  return (
    <CalculatorLayout
      title="DPS and gear comparison"
      description="One engine, several loadouts, one monster. Save a setup and the table ranks it against the others."
      notes={
        <ul className="list-disc space-y-1 pl-4">
          <li>
            Monster and equipment stats come from the OSRS Wiki Bucket API (
            <code>infobox_monster</code>, <code>infobox_bonuses</code>) and are
            regenerated into the repo by hand after a game update, so this page makes no
            upstream request. The equipment list is a curated subset, not every item.
          </li>
          <li>
            Monsters with several forms are listed once per form. Zulrah’s three forms
            have different defences and are genuinely different fights.
          </li>
          <li>
            <strong>Not modelled:</strong> special attacks, weapon-specific scaling
            (Twisted bow, Tumeken’s shadow, Osmumten’s fang’s re-roll), bolt and dart
            procs, elemental weakness, defence reduction over a fight, protection prayers,
            multi-target spells, and the monster fighting back. Time-to-kill assumes
            uninterrupted attacks and no supplies.
          </li>
          <li>
            Saved loadouts live in this browser’s <code>localStorage</code>. There is no
            sign-in and nothing is sent to a server.
          </li>
        </ul>
      }
    >
      <DpsCalculator />
    </CalculatorLayout>
  );
}
