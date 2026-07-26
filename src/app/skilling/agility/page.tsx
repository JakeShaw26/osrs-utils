import type { Metadata } from 'next';
import { CalculatorLayout } from '@/components/templates/CalculatorLayout';
import { AgilityCourseComparator } from '@/components/organisms/skilling/AgilityCourseComparator';
import {
  AGILITY_COURSES,
  AGILITY_DATA_UPDATED,
  AGILITY_DATA_VERSION,
  AGILITY_SOURCE,
} from '@/lib/skilling/agility';

export const metadata: Metadata = {
  title: 'Agility course comparator',
  description:
    'Rooftop Agility course XP rates, laps and marks of grace for any XP goal. No API required.',
};

/**
 * Fully static — Agility has no prices and no upstream (PRD §3.3: "No API").
 * Deliberately NOT `force-dynamic`: with nothing to fetch, prerendering this
 * route is free and it stays up even if every upstream we use is down.
 */
export default function AgilityPage() {
  return (
    <CalculatorLayout
      title="Agility courses"
      description="Laps, hours and marks of grace between here and your target."
      notes={
        <ul className="list-disc space-y-1 pl-4">
          <li>
            XP per lap and level requirements are game constants.{' '}
            <strong>xp/hr and marks/hr are estimates and are shown as ranges</strong>,
            because they vary with diaries, gear and how closely you are watching — a
            single midpoint would be false precision.
          </li>
          <li>
            Data version <span className="tabular">{AGILITY_DATA_VERSION}</span>, updated{' '}
            {AGILITY_DATA_UPDATED} from{' '}
            <a
              href={AGILITY_SOURCE.url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-info underline underline-offset-2"
            >
              {AGILITY_SOURCE.title}
            </a>
            .
          </li>
          <li>
            Failed obstacles are already reflected in the published xp/hr ranges, so they
            are not modelled separately.
          </li>
          <li>
            Course level requirements are boostable, so a locked row is a suggestion
            rather than a rule.
          </li>
        </ul>
      }
    >
      <AgilityCourseComparator courses={AGILITY_COURSES} />
    </CalculatorLayout>
  );
}
