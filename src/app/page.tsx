import Link from 'next/link';
import { Sprite } from '@/components/atoms/Sprite';
import { FeatureCard } from '@/components/organisms/FeatureCard';
import { ThemeToggle } from '@/components/molecules/ThemeToggle';
import { TOOL_GROUPS } from '@/lib/navigation/tools';

/**
 * Landing page — the directory of what exists.
 *
 * The tool list itself lives in `lib/navigation/tools.ts` so it can be checked
 * without rendering: the original scaffold linked to a planned `/tools/*`
 * namespace that was never built, and every link 404'd because nothing could
 * verify them. See that file for the full reasoning.
 *
 * This page makes no network calls, so it needs no environment and cannot be
 * the thing that breaks a cold start.
 */

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="mb-10 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-content sm:text-3xl">
            OSRS Clan Toolkit
          </h1>
          <p className="mt-2 text-content-muted">
            Calculators and lookups for Old School RuneScape. No sign-in — everything here
            is public, and anything you track is saved in your browser.
          </p>
        </div>
        <ThemeToggle />
      </header>

      {TOOL_GROUPS.map((group) => (
        <section key={group.href} className="mb-10">
          {/* The sprite is decorative HERE and only here: the heading beside it
              already says "Economy", so giving it a title would announce the
              word twice to a screen reader. */}
          <h2 className="mb-4 flex items-center gap-3 text-lg font-semibold text-content">
            <Sprite name={group.sprite} size={32} slotted />
            <Link href={group.href} className="hover:text-content-accent">
              {group.heading}
            </Link>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.tools.map((tool) => (
              <FeatureCard
                key={tool.href}
                title={tool.title}
                description={tool.description}
                href={tool.href}
              />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
