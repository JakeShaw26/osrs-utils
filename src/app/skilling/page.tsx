import type { Metadata } from 'next';
import { FeatureCard } from '@/components/organisms/FeatureCard';

/**
 * The skilling tool directory.
 *
 * A server component with no data of its own — it is a list of links, so it
 * needs no client boundary and no fetch. Everything here is statically
 * renderable, which matters because CI builds with no secrets at all.
 */
export const metadata: Metadata = {
  title: 'Skilling tools',
  description:
    'XP calculator, training method comparator, Construction costs and Agility courses.',
};

const TOOLS = [
  {
    title: 'XP calculator',
    description:
      'Current level or XP to a target, with XP remaining, actions required and a level-by-level breakdown. Optional hiscores prefill.',
    href: '/skilling/xp',
  },
  {
    title: 'Training method comparator',
    description:
      'xp/hr and gp/xp per method against live Grand Exchange prices. Every rate is editable and cites its source.',
    href: '/skilling/methods',
  },
  {
    title: 'Construction costs',
    description:
      'Turn an XP goal into a plank shopping list, priced from the live Grand Exchange.',
    href: '/skilling/construction',
  },
  {
    title: 'Agility courses',
    description:
      'Rooftop course xp/hr and marks of grace rates, as ranges rather than false precision.',
    href: '/skilling/agility',
  },
] as const;

export default function SkillingPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-content">Skilling</h1>
        <p className="mt-2 max-w-2xl text-content-muted">
          Calculators for planning a grind. Every tool works without signing in, because
          there is no sign-in — and every one works with prices unavailable.
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
