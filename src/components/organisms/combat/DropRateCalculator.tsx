'use client';

import { useMemo, useState } from 'react';
import { StatBadge } from '@/components/atoms/StatBadge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/components/atoms/Table';
import { NumberField } from '@/components/molecules/combat/NumberField';
import {
  chanceOfAtLeast,
  chanceOfAtLeastOne,
  expectedDrops,
  killsForConfidence,
} from '@/lib/combat/drop-rate';

/**
 * ORGANISM — drop-rate calculator.
 *
 * Takes the rate as a denominator ("1 in N") because that is how the wiki and
 * every player states it; converting to a probability in the UI keeps the
 * domain functions honest about their units.
 */

const CONFIDENCES = [0.5, 0.75, 0.9, 0.95, 0.99];

export function DropRateCalculator() {
  const [denominator, setDenominator] = useState(512);
  const [kills, setKills] = useState(512);

  // Both fields are user-typed, so both can be nonsense. Deciding here — once —
  // means the domain functions never see an invalid value and never need to
  // guess what the user meant.
  const invalidRate = !Number.isFinite(denominator) || denominator < 1;
  const invalidKills = !Number.isInteger(kills) || kills < 0;
  const valid = !invalidRate && !invalidKills;

  const dropChance = valid ? 1 / denominator : 0;

  const summary = useMemo(() => {
    if (!valid) return null;
    return {
      atLeastOne: chanceOfAtLeastOne(dropChance, kills),
      atLeastTwo: chanceOfAtLeast(dropChance, kills, 2),
      expected: expectedDrops(dropChance, kills),
    };
  }, [valid, dropChance, kills]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          label="Drop rate — 1 in"
          value={denominator}
          min={1}
          invalid={invalidRate}
          onValueChange={(next) => setDenominator(next ?? Number.NaN)}
          hint={invalidRate ? 'Enter a denominator of 1 or more' : 'e.g. 512 for 1/512'}
        />
        <NumberField
          label="Kills"
          value={kills}
          min={0}
          invalid={invalidKills}
          onValueChange={(next) => setKills(next ?? Number.NaN)}
          hint={invalidKills ? 'Enter a whole number of kills' : undefined}
        />
      </div>

      {summary ? (
        <>
          <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-sunken p-4">
            <div className="flex items-baseline gap-3">
              <span className="text-2xs font-medium tracking-wide text-content-subtle uppercase">
                Chance of at least one
              </span>
              <output
                aria-label="Chance of at least one"
                className="tabular text-4xl font-bold text-content"
              >
                {formatPercent(summary.atLeastOne)}
              </output>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatBadge label="Expected drops" value={summary.expected.toFixed(2)} />
              <StatBadge label="At least two" value={formatPercent(summary.atLeastTwo)} />
            </div>
          </div>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-content">
              Kills needed for a given confidence
            </h3>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Confidence</TableHeaderCell>
                  <TableHeaderCell numeric>Kills</TableHeaderCell>
                  <TableHeaderCell numeric>Multiple of the rate</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {CONFIDENCES.map((confidence) => {
                  const needed = killsForConfidence(dropChance, confidence);
                  return (
                    <TableRow key={confidence}>
                      <TableCell>{formatPercent(confidence)}</TableCell>
                      <TableCell numeric>{needed.toLocaleString()}</TableCell>
                      <TableCell numeric>{(needed / denominator).toFixed(2)}×</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </section>
        </>
      ) : (
        <p className="rounded-card border border-border bg-surface-sunken p-4 text-sm text-content-muted">
          Enter a drop rate and a kill count to see the odds.
        </p>
      )}
    </div>
  );
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}
