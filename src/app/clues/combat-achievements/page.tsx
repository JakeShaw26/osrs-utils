import type { Metadata } from 'next';
import { CalculatorLayout } from '@/components/templates/CalculatorLayout';
import { CombatAchievementTracker } from '@/components/organisms/clues/CombatAchievementTracker';
import { fetchCombatAchievements } from '@/lib/clues/combat-achievements';
import type { CombatAchievement } from '@/lib/clues/ca-types';

export const metadata: Metadata = {
  title: 'Combat Achievement tracker',
  description:
    'The full Combat Achievement task list from the OSRS Wiki, with self-declared progress stored in your browser.',
};

/**
 * Rendered once and shared by every visitor for a day.
 *
 * Not `force-dynamic`, deliberately. There is no per-visitor variation here —
 * the catalogue is identical for everyone — so one cached render serves the
 * whole clan and the Wiki sees at most one request a day from us. With no auth,
 * caching is a security control as much as a performance one: a per-request
 * fetch would make this route a proxy a stranger could hammer the Wiki through,
 * and it is our IP that gets blocked (ADR-0012, docs/api-terms.md §2).
 */
export const revalidate = 86_400;

/**
 * PAGE — Combat Achievement tracker.
 *
 * Fetching lives here and flows down as props, so the tracker component is
 * testable with a plain array and the page stays a server component.
 */
export default async function CombatAchievementsPage() {
  let achievements: CombatAchievement[] = [];
  let loadError = false;

  try {
    achievements = await fetchCombatAchievements();
  } catch {
    // "Degrade, don't break" (docs/api-terms.md §6.4). The valuable half of this
    // page — the member's own ticked tasks — is in their browser and works with
    // an empty catalogue. Failing the render would throw that away too. This
    // also keeps the secret-free CI build green: with no OSRS_API_USER_AGENT the
    // fetch throws during prerender, and that must not fail the build.
    loadError = true;
  }

  return (
    <CalculatorLayout
      title="Combat Achievement tracker"
      description="Tick off what you have done. The task list is real Wiki data; your progress is self-declared and never leaves this browser."
      notes={
        <div className="space-y-2">
          {loadError ? (
            <p className="text-warning">
              The task catalogue could not be loaded from the OSRS Wiki just now. Anything
              you have already ticked is stored locally and is unaffected.
            </p>
          ) : null}
          <p>
            Task list from the{' '}
            <a
              href="https://oldschool.runescape.wiki/w/Combat_Achievements"
              rel="noreferrer noopener"
              target="_blank"
              className="text-primary hover:underline"
            >
              OSRS Wiki
            </a>{' '}
            Bucket API (<code>combat_achievement</code>), refreshed daily and shared by
            every visitor. Used under CC BY-NC-SA 4.0.
          </p>
          <p>
            Completion is <strong>self-reported</strong>. Combat Achievements are not in
            the hiscores and no public API exposes them, so nothing here is verified
            against the game and none of it feeds a clan leaderboard.
          </p>
        </div>
      }
    >
      <CombatAchievementTracker achievements={achievements} />
    </CalculatorLayout>
  );
}
