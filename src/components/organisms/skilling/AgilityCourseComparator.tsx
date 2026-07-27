'use client';

import { useMemo, useState } from 'react';
import { StatBadge } from '@/components/atoms/StatBadge';
import {
  Table,
  TableBody,
  TableCell,
  TableEmptyRow,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/components/atoms/Table';
import { NumericField } from '@/components/molecules/skilling/NumericField';
import { compareCourses } from '@/lib/skilling/agility';
import { formatCount, parseCount } from '@/lib/utils/parse-quantity';
import type { AgilityCourse } from '@/lib/skilling/types';
import { levelForXp, planXpGoal, xpForLevel } from '@/lib/skilling/xp';

/**
 * ORGANISM — the Agility rooftop course comparator.
 *
 * PRD §3.3: "Course xp/hr and mark rates authored. No API."
 *
 * Every rate is shown as a RANGE, not a midpoint. Seers' Village runs at 40k/hr
 * without the Kandarin Hard diary and 56k/hr with it; publishing 48k as if it
 * were the answer is the "authored estimate presented as fact" failure the PRD
 * warns about. The range makes the uncertainty part of the reading.
 */

interface AgilityCourseComparatorProps {
  courses: readonly AgilityCourse[];
}

export function AgilityCourseComparator({ courses }: AgilityCourseComparatorProps) {
  const [currentInput, setCurrentInput] = useState('');
  const [targetInput, setTargetInput] = useState('99');

  const parsedCurrent = parseCount(currentInput);
  const parsedTarget = parseCount(targetInput);

  const goal = useMemo(() => {
    if (parsedCurrent === null || parsedTarget === null) return null;
    return planXpGoal({
      currentXp: parsedCurrent,
      target: { kind: 'level', level: parsedTarget },
    });
  }, [parsedCurrent, parsedTarget]);

  const rows = useMemo(
    () => compareCourses(goal?.xpRemaining ?? 0, goal?.currentLevel ?? 1, courses),
    [goal, courses],
  );

  const currentError =
    currentInput.trim() !== '' && parsedCurrent === null
      ? 'Enter a number. 1,000 / 1k / 1.5m all work.'
      : undefined;

  const targetError =
    targetInput.trim() !== '' && parsedTarget === null
      ? 'Enter a number. 1,000 / 1k / 1.5m all work.'
      : goal?.problem === 'target-below-current'
        ? 'Your target level is below your current XP.'
        : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <NumericField
          id="agi-current-xp"
          label="Current Agility XP"
          value={currentInput}
          onChange={setCurrentInput}
          hint="Or type a level below and read the XP off the table."
          error={currentError}
          placeholder="737,627"
          suffix={parsedCurrent !== null ? `lvl ${levelForXp(parsedCurrent)}` : undefined}
        />
        <NumericField
          id="agi-target-level"
          label="Target level"
          value={targetInput}
          onChange={setTargetInput}
          error={targetError}
          placeholder="99"
          suffix={
            parsedTarget !== null
              ? `${formatCount(xpForLevel(parsedTarget))} xp`
              : undefined
          }
        />
      </div>

      {goal ? (
        <div className="flex flex-wrap gap-2">
          <StatBadge label="Current level" value={goal.currentLevel} />
          <StatBadge
            label="XP remaining"
            value={formatCount(goal.xpRemaining)}
            tone="warning"
          />
        </div>
      ) : (
        <p className="text-sm text-content-muted">
          Enter your current XP and a target to see laps, hours and marks. Course rates
          are shown either way.
        </p>
      )}

      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Course</TableHeaderCell>
            <TableHeaderCell numeric>Lvl</TableHeaderCell>
            <TableHeaderCell numeric>XP/lap</TableHeaderCell>
            <TableHeaderCell numeric>XP/hr</TableHeaderCell>
            <TableHeaderCell numeric>Marks/hr</TableHeaderCell>
            <TableHeaderCell numeric>Laps</TableHeaderCell>
            <TableHeaderCell numeric>Hours</TableHeaderCell>
            <TableHeaderCell numeric>Marks</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 ? (
            <TableEmptyRow colSpan={8}>No courses are configured.</TableEmptyRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.course.id}>
                <TableCell>
                  <span className={row.locked ? 'text-content-subtle' : 'text-content'}>
                    {row.course.name}
                  </span>
                  {row.recommended ? (
                    <span className="ml-2 text-2xs text-info">best for you</span>
                  ) : null}
                  {row.course.note ? (
                    <p className="mt-0.5 max-w-xs text-2xs text-content-subtle">
                      {row.course.note}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell numeric>{row.course.minLevel}</TableCell>
                <TableCell numeric>{row.course.xpPerLap}</TableCell>
                <TableCell numeric>
                  {formatCount(row.course.xpPerHour.low)}–
                  {formatCount(row.course.xpPerHour.high)}
                </TableCell>
                <TableCell numeric>
                  {row.course.marksPerHour.low}–{row.course.marksPerHour.high}
                </TableCell>
                <TableCell numeric>
                  {row.laps === null ? '—' : formatCount(row.laps)}
                </TableCell>
                <TableCell numeric>
                  {row.hours === null
                    ? '—'
                    : `${row.hours.low.toFixed(1)}–${row.hours.high.toFixed(1)}`}
                </TableCell>
                <TableCell numeric>
                  {row.marks === null
                    ? '—'
                    : `${formatCount(row.marks.low)}–${formatCount(row.marks.high)}`}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
