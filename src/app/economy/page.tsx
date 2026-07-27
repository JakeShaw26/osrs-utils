import type { Metadata } from 'next';
import { FeatureCard } from '@/components/organisms/FeatureCard';

export const metadata: Metadata = {
  title: 'Economy',
  description:
    'Grand Exchange prices, high alch profit, price history and a flipping calculator for Old School RuneScape.',
};

const TOOLS = [
  {
    title: 'GE price lookup',
    description:
      'Search any tradeable item for live buy and sell prices, margin after tax, buy limit, alch value and trade volume.',
    href: '/economy/prices',
  },
  {
    title: 'High alch profit',
    description:
      'Items ranked by realistic gp/hour from High Level Alchemy, capped by the Grand Exchange buy limit rather than by casting speed.',
    href: '/economy/high-alch',
  },
  {
    title: 'Flipping calculator',
    description:
      'Margin after the 2% Grand Exchange tax, with a volume warning so a fat margin on a dead item is obvious.',
    href: '/economy/flipping',
  },
] as const;

export default function EconomyPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-content sm:text-3xl">
          Economy
        </h1>
        <p className="mt-2 max-w-2xl text-content-muted">
          Live Grand Exchange data from the OSRS Wiki real-time prices API. Price history
          goes back one year, which is as far as the data exists.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
