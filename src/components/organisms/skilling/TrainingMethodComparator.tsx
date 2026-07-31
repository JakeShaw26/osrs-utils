'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
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
import { NumericField } from '@/components/molecules/NumericField';
import { SelectField } from '@/components/molecules/SelectField';
import { formatCount, parseCount, parseQuantity } from '@/lib/utils/parse-quantity';
import {
  compareMethods,
  sortComparedMethods,
  type ComparedMethod,
  type MethodSort,
} from '@/lib/skilling/training-methods';
import type { ItemPrices, TrainingMethod } from '@/lib/skilling/types';
import { planXpGoal } from '@/lib/skilling/xp';
import { formatGp } from '@/lib/utils/format-gp';

/**
 * ORGANISM — the training method comparator.
 *
 * THE POINT OF THIS COMPONENT (PRD §3.3)
 *
 * xp/hr rates are authored estimates and are "inherently contentious". The PRD
 * requires they be shown "as editable assumptions rather than facts, and cite
 * their origin — otherwise every disagreement about rates becomes a bug report."
 *
 * Both halves are structural here, not decoration:
 *
 *  - The xp/hr column is an INPUT, not text. Disagreeing with a rate is a
 *    two-second edit that changes your own answer.
 *  - Every row links its source. A rate with no citation cannot be added,
 *    because `TrainingMethod['source']` is a required field.
 *
 * Prices are live and passed in as props — this organism fetches nothing.
 */

interface TrainingMethodComparatorProps {
  methods: readonly TrainingMethod[];
  prices: ItemPrices;
  /** The upstream could not be reached at all, as opposed to an item having no price. */
  pricesUnavailable: boolean;
}

export function TrainingMethodComparator({
  methods,
  prices,
  pricesUnavailable,
}: TrainingMethodComparatorProps) {
  const skills = useMemo(
    () => [...new Set(methods.map((method) => method.skill))].sort(),
    [methods],
  );

  const [skill, setSkill] = useState<string>(skills[0] ?? '');
  const [currentInput, setCurrentInput] = useState('');
  const [targetInput, setTargetInput] = useState('99');
  const [sort, setSort] = useState<MethodSort>('cheapest');
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const parsedCurrent = parseCount(currentInput);
  const parsedTarget = parseCount(targetInput);

  const goal = useMemo(() => {
    if (parsedCurrent === null || parsedTarget === null) return null;
    return planXpGoal({
      currentXp: parsedCurrent,
      target: { kind: 'level', level: parsedTarget },
    });
  }, [parsedCurrent, parsedTarget]);

  const rows = useMemo(() => {
    const numericOverrides: Record<string, number> = {};
    for (const [id, raw] of Object.entries(overrides)) {
      const value = parseQuantity(raw);
      if (value !== null && value > 0) numericOverrides[id] = value;
    }

    const compared = compareMethods(
      methods.filter((method) => method.skill === skill),
      {
        prices,
        xpRemaining: goal?.xpRemaining ?? 0,
        xpPerHourOverrides: numericOverrides,
        currentLevel: goal?.currentLevel,
      },
    );

    return sortComparedMethods(compared, sort);
  }, [methods, skill, prices, goal, overrides, sort]);

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

  const hasOverrides = Object.keys(overrides).length > 0;

  return (
    <div className="flex flex-col gap-6">
      {pricesUnavailable ? (
        <p role="status" className="text-sm text-warning">
          Live Grand Exchange prices are unavailable right now, so gp/xp is blank. The
          xp/hr and action figures below are unaffected.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SelectField
          id="cmp-skill"
          label="Skill"
          value={skill}
          onChange={setSkill}
          options={skills.map((name) => ({ value: name, label: name }))}
        />

        <NumericField
          id="cmp-current-xp"
          label="Current XP"
          value={currentInput}
          onChange={setCurrentInput}
          error={currentError}
          placeholder="737,627"
        />

        <NumericField
          id="cmp-target-level"
          label="Target level"
          value={targetInput}
          onChange={setTargetInput}
          error={targetError}
          placeholder="99"
        />

        <SelectField
          id="cmp-sort"
          label="Sort by"
          value={sort}
          onChange={(next) => setSort(next as MethodSort)}
          options={[
            { value: 'cheapest', label: 'Cheapest (gp/xp)' },
            { value: 'fastest', label: 'Fastest (xp/hr)' },
            { value: 'level', label: 'Level required' },
          ]}
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
          Enter your current XP and a target level to see totals and time. The rates below
          are shown either way.
        </p>
      )}

      {hasOverrides ? (
        <div className="flex items-center gap-3">
          <StatBadge
            label="Rates edited"
            value={Object.keys(overrides).length}
            tone="info"
          />
          <Button variant="ghost" onClick={() => setOverrides({})}>
            Reset rates to the authored values
          </Button>
        </div>
      ) : null}

      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Method</TableHeaderCell>
            <TableHeaderCell numeric>Lvl</TableHeaderCell>
            <TableHeaderCell numeric>XP/action</TableHeaderCell>
            <TableHeaderCell numeric>XP/hr (editable)</TableHeaderCell>
            <TableHeaderCell numeric>gp/xp</TableHeaderCell>
            <TableHeaderCell numeric>Actions</TableHeaderCell>
            <TableHeaderCell numeric>Hours</TableHeaderCell>
            <TableHeaderCell numeric>Total gp</TableHeaderCell>
            <TableHeaderCell>Rate source</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 ? (
            <TableEmptyRow colSpan={9}>
              No authored methods for {skill} yet.
            </TableEmptyRow>
          ) : (
            rows.map((row) => (
              <MethodRow
                key={row.method.id}
                row={row}
                override={overrides[row.method.id] ?? ''}
                onOverride={(value) =>
                  setOverrides((previous) => {
                    // Clearing the box removes the override entirely rather
                    // than storing "", so the row returns to the authored rate
                    // and stops counting towards "rates edited".
                    if (value.trim() === '') {
                      const next = { ...previous };
                      delete next[row.method.id];
                      return next;
                    }
                    return { ...previous, [row.method.id]: value };
                  })
                }
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function MethodRow({
  row,
  override,
  onOverride,
}: {
  row: ComparedMethod;
  override: string;
  onOverride: (value: string) => void;
}) {
  const { method } = row;

  return (
    <TableRow>
      <TableCell>
        <span className={row.locked ? 'text-content-subtle' : 'text-content'}>
          {method.name}
        </span>
        {row.locked ? (
          <span className="ml-2 text-2xs text-content-subtle">
            (level {method.minLevel})
          </span>
        ) : null}
        {method.note ? (
          <p className="mt-0.5 max-w-xs text-2xs text-content-subtle">{method.note}</p>
        ) : null}
        {row.unpricedItems.length > 0 ? (
          <p className="mt-0.5 max-w-xs text-2xs text-warning">
            No price for: {row.unpricedItems.join(', ')}
          </p>
        ) : null}
      </TableCell>

      <TableCell numeric>{method.minLevel}</TableCell>
      <TableCell numeric>{method.xpPerAction}</TableCell>

      <TableCell numeric>
        <Input
          numeric
          type="text"
          inputMode="numeric"
          className="w-28 py-1"
          aria-label={`XP per hour for ${method.name}`}
          placeholder={String(method.xpPerHour)}
          value={override}
          onChange={(event) => onOverride(event.target.value)}
        />
        {row.overridden ? (
          <span className="mt-0.5 block text-2xs text-info">edited</span>
        ) : null}
      </TableCell>

      <TableCell numeric>
        <GpPerXp value={row.gpPerXp} />
      </TableCell>

      <TableCell numeric>
        {row.actions === null ? '—' : formatCount(row.actions)}
      </TableCell>

      <TableCell numeric>{row.hours === null ? '—' : row.hours.toFixed(1)}</TableCell>

      <TableCell numeric>
        {row.totalGp === null ? (
          <span className="text-content-subtle">—</span>
        ) : (
          <span
            className={row.totalGp < 0 ? 'tabular text-profit' : 'tabular text-content'}
          >
            {row.totalGp < 0 ? `+${formatGp(-row.totalGp)}` : formatGp(row.totalGp)}
          </span>
        )}
      </TableCell>

      <TableCell>
        <a
          href={method.source.url}
          target="_blank"
          rel="noreferrer noopener"
          className="text-2xs text-info underline underline-offset-2"
        >
          {method.source.title}
        </a>
        <span className="block text-2xs text-content-subtle">
          read {method.source.retrieved}
        </span>
      </TableCell>
    </TableRow>
  );
}

/**
 * gp/xp, with negative rendered as profit.
 *
 * A negative cost is the single most useful fact about a method — prayer
 * potions pay you to train Herblore — so it gets the `profit` domain token
 * rather than `success`. A method making money is not a "successful" outcome of
 * a validation, and the two must be restylable independently (docs/theming.md).
 */
function GpPerXp({ value }: { value: number | null }) {
  if (value === null) return <span className="text-content-subtle">—</span>;

  if (value < 0) {
    return <span className="tabular text-profit">+{Math.abs(value).toFixed(2)}</span>;
  }

  return <span className="tabular text-content">{value.toFixed(2)}</span>;
}
