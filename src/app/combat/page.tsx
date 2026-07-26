import type { Metadata } from 'next';
import { FeatureCard } from '@/components/organisms/FeatureCard';

export const metadata: Metadata = {
  title: 'Combat tools',
  description:
    'Maximum hit, DPS and gear comparison for Old School RuneScape, computed from the wiki’s published combat formulas.',
};

/**
 * PAGE — the combat tool directory.
 *
 * A server component with no client JavaScript: it renders links, and nothing
 * on it is interactive. It also makes no network request — every combat tool
 * runs against data committed to the repo (ADR-0015).
 */
export default function CombatPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-content sm:text-3xl">
          Combat
        </h1>
        <p className="mt-2 max-w-2xl text-content-muted">
          Damage and accuracy maths, implemented from the OSRS Wiki’s published combat
          formulas. Monster and equipment stats come from the wiki’s Bucket API and are
          baked into the site, so nothing here waits on a network call.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <FeatureCard
          title="Maximum hit"
          description="Melee, ranged and magic. Prayers, potions, Void, slayer helm, salve amulet and Dharok’s."
          href="/combat/max-hit"
        />
        <FeatureCard
          title="DPS and gear comparison"
          description="Run several loadouts against one monster and rank them. Saved loadouts stay in your browser."
          href="/combat/dps"
        />
        <FeatureCard
          title="Drop rate"
          description="How likely a drop is over N kills, and how many kills a given confidence really takes."
          href="/combat/drop-rate"
        />
        <FeatureCard
          title="Slayer task helper"
          description="Task weightings per master are hand-authored data the wiki does not publish."
          href="/combat/slayer"
          comingSoon
        />
      </div>
    </main>
  );
}
