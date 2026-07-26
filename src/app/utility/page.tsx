import type { Metadata } from 'next';
import { FeatureCard } from '@/components/organisms/FeatureCard';

export const metadata: Metadata = {
  title: 'Utility tools',
  description:
    'Reset countdowns, a tick-accurate prayer flicking timer, wilderness death risk and minigame point calculators.',
};

/**
 * PAGE — the utility tool directory.
 *
 * A server component with no interactivity and no data source, so nothing here
 * reaches the browser as JavaScript. Each tool it links to owns its own client
 * boundary, on the smallest leaf that needs one.
 */

const TOOLS = [
  {
    title: 'Reset tracker',
    description:
      'Countdowns to the daily, weekly and monthly resets, in game time (UTC) and yours.',
    href: '/utility/resets',
  },
  {
    title: 'Prayer flicking timer',
    description:
      'A 0.6s metronome anchored to a monotonic clock, so the beat does not drift away from the server tick.',
    href: '/utility/prayer-flick',
  },
  {
    title: 'Wilderness death risk',
    description:
      'What you keep, what you lose and what that costs at live Grand Exchange prices.',
    href: '/utility/death-risk',
  },
  {
    title: 'Minigame points',
    description:
      'How many games or contracts stand between you and a point total, and how long that is.',
    href: '/utility/minigames',
  },
] as const;

export default function UtilityIndexPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-content sm:text-3xl">
          Utility tools
        </h1>
        <p className="mt-2 max-w-2xl text-content-muted">
          Small, self-contained tools. Nothing here needs an account, and nothing you type
          is sent anywhere.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {TOOLS.map((tool) => (
          <FeatureCard
            key={tool.href}
            title={tool.title}
            description={tool.description}
            href={tool.href}
          />
        ))}
      </div>
    </main>
  );
}
