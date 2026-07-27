'use client';

import { useMemo, useState } from 'react';
import { PriceTag } from '@/components/atoms/PriceTag';
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
import { SelectField } from '@/components/molecules/skilling/SelectField';
import { planConstruction } from '@/lib/skilling/construction';
import { formatCount, parseCount } from '@/lib/skilling/parse-quantity';
import type { ConstructionBuild, ItemPrices } from '@/lib/skilling/types';
import { planXpGoal } from '@/lib/skilling/xp';

/**
 * ORGANISM — Construction cost calculator.
 *
 * PRD §3.3: "Material lists per item authored; prices live." The output is a
 * shopping list, not a rate — the question Construction actually gets asked is
 * "how many planks do I buy and what will that cost", and answering it in
 * gp/xp would make a player do the multiplication themselves.
 *
 * Fetches nothing. Prices arrive as props from the page.
 */

interface ConstructionCalculatorProps {
  builds: readonly ConstructionBuild[];
  prices: ItemPrices;
  pricesUnavailable: boolean;
}

export function ConstructionCalculator({
  builds,
  prices,
  pricesUnavailable,
}: ConstructionCalculatorProps) {
  const [buildId, setBuildId] = useState(builds[0]?.id ?? '');
  const [currentInput, setCurrentInput] = useState('');
  const [targetInput, setTargetInput] = useState('99');

  const build = builds.find((candidate) => candidate.id === buildId) ?? builds[0];

  const parsedCurrent = parseCount(currentInput);
  const parsedTarget = parseCount(targetInput);

  const goal = useMemo(() => {
    if (parsedCurrent === null || parsedTarget === null) return null;
    return planXpGoal({
      currentXp: parsedCurrent,
      target: { kind: 'level', level: parsedTarget },
    });
  }, [parsedCurrent, parsedTarget]);

  const plan = useMemo(
    () => (build ? planConstruction(build, goal?.xpRemaining ?? 0, prices) : null),
    [build, goal, prices],
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

  const belowLevel =
    build && goal !== null && goal.currentLevel < build.minLevel ? build.minLevel : null;

  return (
    <div className="flex flex-col gap-6">
      {pricesUnavailable ? (
        <p role="status" className="text-sm text-warning">
          Live Grand Exchange prices are unavailable right now. Quantities below are still
          correct — only the costs are blank.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField
          id="con-build"
          label="Build"
          value={buildId}
          onChange={setBuildId}
          options={builds.map((candidate) => ({
            value: candidate.id,
            label: `${candidate.name} (lvl ${candidate.minLevel})`,
          }))}
        />
        <NumericField
          id="con-current-xp"
          label="Current Construction XP"
          value={currentInput}
          onChange={setCurrentInput}
          error={currentError}
          placeholder="1,210,421"
        />
        <NumericField
          id="con-target-level"
          label="Target level"
          value={targetInput}
          onChange={setTargetInput}
          error={targetError}
          placeholder="99"
        />
      </div>

      {belowLevel !== null ? (
        <p role="status" className="text-sm text-warning">
          This build needs level {belowLevel}. Construction levels are boostable, so the
          numbers below still hold once you can reach it.
        </p>
      ) : null}

      {goal === null || plan === null ? (
        <p className="text-sm text-content-muted">
          Enter your current XP and a target level to get a shopping list.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <StatBadge
              label="XP remaining"
              value={formatCount(goal.xpRemaining)}
              tone="warning"
            />
            <StatBadge
              label="Builds"
              value={plan.builds === null ? '—' : formatCount(plan.builds)}
              tone="info"
            />
            <StatBadge
              label="Hours"
              value={plan.hours === null ? '—' : plan.hours.toFixed(1)}
            />
            <StatBadge
              label="gp/xp"
              value={plan.costPerXp === null ? '—' : plan.costPerXp.toFixed(2)}
            />
          </div>

          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Material</TableHeaderCell>
                <TableHeaderCell numeric>Per build</TableHeaderCell>
                <TableHeaderCell numeric>Total needed</TableHeaderCell>
                <TableHeaderCell numeric>Unit price</TableHeaderCell>
                <TableHeaderCell numeric>Line cost</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {plan.materials.length === 0 ? (
                <TableEmptyRow colSpan={5}>This build needs no materials.</TableEmptyRow>
              ) : (
                plan.materials.map((line) => (
                  <TableRow key={line.item}>
                    <TableCell>{line.item}</TableCell>
                    <TableCell numeric>{line.perBuild}</TableCell>
                    <TableCell numeric>{formatCount(line.totalQuantity)}</TableCell>
                    <TableCell numeric>
                      {line.unitPrice === null ? (
                        <span className="text-content-subtle">no price</span>
                      ) : (
                        <PriceTag amount={line.unitPrice} />
                      )}
                    </TableCell>
                    <TableCell numeric>
                      {line.lineCost === null ? (
                        <span className="text-content-subtle">—</span>
                      ) : (
                        <PriceTag amount={line.lineCost} />
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
              <TableRow>
                <TableCell colSpan={4} className="font-medium">
                  Total
                </TableCell>
                <TableCell numeric className="font-medium">
                  {plan.totalCost === null ? (
                    <span className="text-content-subtle">—</span>
                  ) : (
                    <PriceTag amount={plan.totalCost} />
                  )}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </>
      )}
    </div>
  );
}
