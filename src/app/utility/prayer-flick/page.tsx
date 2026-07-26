import type { Metadata } from 'next';
import { CalculatorLayout } from '@/components/templates/CalculatorLayout';
import { PrayerFlickTimer } from '@/components/organisms/utility/PrayerFlickTimer';

export const metadata: Metadata = {
  title: 'Prayer flicking timer',
  description: 'A 0.6 second game-tick metronome for practising prayer flicking.',
};

export default function PrayerFlickPage() {
  return (
    <CalculatorLayout
      title="Prayer flicking timer"
      description="A metronome on the 0.6 second game tick. Match the switch, keep your prayer points."
      notes={
        <ul className="grid gap-2">
          <li>
            The beat is recalculated from a monotonic clock on every animation frame
            rather than counted up by a timer, so it cannot drift out of step with the
            game the way an interval-driven timer does.
          </li>
          <li>
            It is <strong>not</strong> synchronised to the server tick — nothing
            client-side can be. It gives you the right rhythm, not the right phase, so
            start it on a tick you can see in-game.
          </li>
          <li>
            Hide the tab and the browser stops the animation. That is deliberate: a
            metronome you cannot see is not helping.
          </li>
        </ul>
      }
    >
      <PrayerFlickTimer />
    </CalculatorLayout>
  );
}
