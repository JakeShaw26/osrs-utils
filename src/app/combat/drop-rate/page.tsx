import type { Metadata } from 'next';
import { DropRateCalculator } from '@/components/organisms/combat/DropRateCalculator';
import { CalculatorLayout } from '@/components/templates/CalculatorLayout';

export const metadata: Metadata = {
  title: 'Drop rate calculator',
  description: 'Binomial drop-rate odds over a given number of kills.',
};

export default function DropRatePage() {
  return (
    <CalculatorLayout
      title="Drop rate"
      description="How likely a drop is over N kills, and how dry you can reasonably expect to go."
      notes={
        <ul className="list-disc space-y-1 pl-4">
          <li>
            Plain binomial probability — no game data involved, so nothing here can go
            stale.
          </li>
          <li>
            Assumes each kill is independent and the rate is constant. That is not true
            for rates that scale with a raid level, a personal points total, or a
            unique-table roll, so treat those as approximations.
          </li>
          <li>
            Drops already obtained do not change your odds on the next kill. Being dry is
            not a state the game tracks.
          </li>
        </ul>
      }
    >
      <DropRateCalculator />
    </CalculatorLayout>
  );
}
