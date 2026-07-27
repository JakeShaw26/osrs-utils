import type { Metadata } from 'next';
import Link from 'next/link';
import { CalculatorLayout } from '@/components/templates/CalculatorLayout';
import { QuestIndex } from '@/components/organisms/quests/QuestIndex';
import { QUESTS, QUEST_COVERAGE } from '@/lib/quests';

/**
 * PAGE — the quest index.
 *
 * A server component: the dataset is a static import, so there is nothing to
 * fetch and nothing that needs the client. The one interactive part (search
 * and filtering) is the `QuestIndex` organism, which carries the
 * `"use client"` boundary itself.
 */

export const metadata: Metadata = {
  title: 'Quests — OSRS Clan Toolkit',
  description:
    'Browse quest requirements, and work out which quests your levels let you start.',
};

export default function QuestsPage() {
  const namesById = Object.fromEntries(QUESTS.map((quest) => [quest.id, quest.name]));

  return (
    <CalculatorLayout
      title="Quests"
      description="Requirements for every modelled quest, and what your levels unlock."
      notes={
        <div className="flex flex-col gap-2">
          <p>
            Requirements come from the OSRS Wiki&rsquo;s <code>quest</code> Bucket data
            and its quest lists, captured 2026-07-26. Quest points awarded, difficulty and
            length come from the wiki&rsquo;s own quest tables.
          </p>
          <p>
            <strong className="font-medium text-content">
              Coverage is partial and deliberate.
            </strong>{' '}
            <span className="tabular">{QUEST_COVERAGE.modelled}</span> of{' '}
            <span className="tabular">{QUEST_COVERAGE.inGame}</span> quests are modelled:
            every free-to-play quest, plus the members&rsquo; quests that are
            prerequisites of others. A wrong prerequisite makes the planner worse than
            useless, so quests are added only once their requirements have been checked.
          </p>
          <p>
            <strong className="font-medium text-content">
              Completion cannot be read from the hiscores.
            </strong>{' '}
            Jagex does not publish quest points or quest completion, so anything about
            what you have finished is self-declared and stored in your browser only.
          </p>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <nav className="flex flex-wrap gap-3">
          <Link
            href="/quests/planner"
            className="rounded-control bg-primary px-4 py-2 text-sm font-medium text-primary-content hover:bg-primary-hover"
          >
            What can I do now?
          </Link>
          <Link
            href="/quests/diaries"
            className="rounded-control border border-border bg-surface-sunken px-4 py-2 text-sm font-medium text-content hover:bg-surface-hover"
          >
            Diary requirement checker
          </Link>
        </nav>

        <QuestIndex quests={QUESTS} namesById={namesById} />
      </div>
    </CalculatorLayout>
  );
}
