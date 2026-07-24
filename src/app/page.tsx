import { FeatureCard } from '@/components/organisms/FeatureCard';
import { PriceChangeIndicator } from '@/components/molecules/PriceChangeIndicator';
import { ThemeToggle } from '@/components/molecules/ThemeToggle';
import { StatBadge } from '@/components/atoms/StatBadge';
import { PriceTag } from '@/components/atoms/PriceTag';

/**
 * Scaffolding home page — a live proof that the conventions work together, not
 * a designed landing page.
 *
 * It demonstrates: every atomic layer rendering, semantic tokens surviving a
 * light/dark switch, and a server page hosting one small client island
 * (ThemeToggle) without becoming a client component itself.
 *
 * Replace this when the real tool directory is built. Values below are static
 * placeholders — this scaffold makes no network calls. (PRD §1.5, P0)
 */

const PLANNED_TOOLS = [
  {
    title: 'GE Price Lookup',
    description: 'Live Grand Exchange prices and history from the OSRS Wiki API.',
    href: '/tools/prices',
  },
  {
    title: 'Flipping Calculator',
    description: 'Margin, GE tax and ROI, with volume warnings on illiquid items.',
    href: '/tools/flipping',
  },
  {
    title: 'High Alch Profit',
    description: 'Alch value against live buy price and nature rune cost.',
    href: '/tools/high-alch',
  },
  {
    title: 'DPS Calculator',
    description: 'Gear, prayers and boosts against monster stats.',
    href: '/tools/dps',
  },
  {
    title: 'XP Calculator',
    description: 'Current level to target, with method comparisons.',
    href: '/tools/xp',
  },
  {
    title: 'Clan Leaderboards',
    description: 'XP gained, boss KC races and clue completions.',
    href: '/clan/leaderboard',
    membersOnly: true,
  },
] as const;

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <header className="mb-10 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-content">
            OSRS Clan Toolkit
          </h1>
          <p className="mt-2 text-content-muted">
            Foundation scaffold. No features are implemented yet.
          </p>
        </div>
        <ThemeToggle />
      </header>

      {/* Token/'component proof — delete once real features land. */}
      <section className="mb-10 rounded-card border border-border bg-surface-raised p-4 shadow-card">
        <h2 className="text-2xs font-semibold tracking-wide text-content-subtle uppercase">
          Component &amp; token proof
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <PriceTag amount={1_478_143_929n} />
          <PriceChangeIndicator current={1_478_143_929n} previous={1_402_000_000n} />
          <PriceChangeIndicator current={39_000n} previous={44_500n} />
          <StatBadge label="Max hit" value="54" tone="info" />
          <StatBadge label="Members" value="Yes" tone="members" />
          <StatBadge label="Tax" value="2%" tone="warning" />
        </div>
        <p className="mt-3 text-sm text-content-muted">
          Toggle the theme — every colour above is a semantic token, so nothing here needs
          a light/dark conditional.
        </p>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-content">Planned tools</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PLANNED_TOOLS.map((tool) => (
            <FeatureCard
              key={tool.href}
              title={tool.title}
              description={tool.description}
              href={tool.href}
              membersOnly={'membersOnly' in tool ? tool.membersOnly : false}
              comingSoon
            />
          ))}
        </div>
      </section>
    </div>
  );
}
