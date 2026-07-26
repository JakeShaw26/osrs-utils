import type { Metadata } from 'next';
import Link from 'next/link';
import { CalculatorLayout } from '@/components/templates/CalculatorLayout';
import { DiaryChecker } from '@/components/organisms/quests/DiaryChecker';

export const metadata: Metadata = {
  title: 'Diary requirement checker — OSRS Clan Toolkit',
  description:
    'Which achievement diary tiers your skill levels could complete. Requirements from the OSRS Wiki.',
};

export default function DiariesPage() {
  return (
    <CalculatorLayout
      title="Diary requirement checker"
      description="Which achievement diary tiers your levels could complete — all twelve diaries, all four tiers."
      notes={
        <div className="flex flex-col gap-2">
          <p>
            Requirements come from the per-tier summary table on each diary page of the
            OSRS Wiki, captured 2026-07-26. Each level was cross-checked against both the
            table&rsquo;s machine-readable attribute and its visible text; the two agreed
            across all 48 tiers.
          </p>
          <p>
            <strong className="font-medium text-content">
              Achievement diaries are not in the hiscores.
            </strong>{' '}
            Verified against the live endpoint — all 90 activities were enumerated and no
            diary appears among them. So this tells you what you <em>could</em> complete,
            never what you have. Nothing here is a leaderboard and it never will be.
          </p>
          <p>
            Quest requirements for individual diary tasks are not modelled yet, and
            ironman-only requirements are excluded. A tier shown as achievable may still
            be gated by a quest.
          </p>
          <p>
            <Link href="/quests" className="text-primary underline">
              Back to the quest index
            </Link>
          </p>
        </div>
      }
    >
      <DiaryChecker />
    </CalculatorLayout>
  );
}
