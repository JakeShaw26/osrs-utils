import type { Metadata } from 'next';
import Link from 'next/link';
import { CalculatorLayout } from '@/components/templates/CalculatorLayout';
import { QuestPlanner } from '@/components/organisms/quests/QuestPlanner';

/**
 * PAGE — "what can I do now?".
 *
 * Server component with one client island. The planner reads and writes
 * `localStorage`, so it must be a client component — but that boundary belongs
 * on the organism, not here, so this page and its layout stay off the client
 * bundle.
 */

export const metadata: Metadata = {
  title: 'What can I do now? — OSRS Clan Toolkit',
  description:
    'Enter your levels and see which quests you can start, with the full prerequisite chain for the ones you cannot.',
};

export default function QuestPlannerPage() {
  return (
    <CalculatorLayout
      title="What can I do now?"
      description="Your levels decide what you can start. Tick off what you have already done — we cannot see it."
      notes={
        <div className="flex flex-col gap-2">
          <p>
            <strong className="font-medium text-content">
              Levels are real; completions are not.
            </strong>{' '}
            Skill levels come from the Jagex hiscores or from what you type. Quest
            completion is absent from the hiscores entirely, so every tick you make here
            is your word for it, stored in this browser and nowhere else.
          </p>
          <p>
            Requirements listed under &ldquo;not checked by this tool&rdquo; — the ability
            to beat a boss, a quest partner, area access — are real requirements we cannot
            evaluate from levels. A quest shown as startable may still need one of them.
          </p>
          <p>
            Boosts are shown but never assumed: a boostable requirement still counts as
            unmet, because we cannot know whether you have the potion.
          </p>
          <p>
            <Link href="/quests" className="text-primary underline">
              Back to the quest index
            </Link>
          </p>
        </div>
      }
    >
      <QuestPlanner />
    </CalculatorLayout>
  );
}
