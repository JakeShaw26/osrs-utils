import type { Metadata } from 'next';
import { CalculatorLayout } from '@/components/templates/CalculatorLayout';
import { MinigamePointsCalculator } from '@/components/organisms/utility/MinigamePointsCalculator';

export const metadata: Metadata = {
  title: 'Minigame point calculator',
  description:
    'How many games or contracts you need for a point total, and roughly how long that takes.',
};

export default function MinigamesPage() {
  return (
    <CalculatorLayout
      title="Minigame points"
      description="How many runs stand between you and the reward you are saving for."
      notes={
        <ul className="grid gap-2">
          <li>
            Point tables are authored from the OSRS Wiki, not fetched — no API serves
            them. Each minigame states its source, and anything player-reported rather
            than documented says so on screen.
          </li>
          <li>
            Time estimates use the runs-per-hour you enter. The defaults are rough
            averages and include no allowance for lobby waits, banking or a bad team.
          </li>
          <li>A partial run earns nothing, so the count always rounds up.</li>
        </ul>
      }
    >
      <MinigamePointsCalculator />
    </CalculatorLayout>
  );
}
