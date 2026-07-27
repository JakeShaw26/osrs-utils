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
import { NumericField } from '@/components/molecules/skilling/NumericField';
import { SelectField } from '@/components/molecules/skilling/SelectField';
import { formatCount, parseCount } from '@/lib/skilling/parse-quantity';
import { SKILL_OPTIONS } from '@/lib/skilling/skills';
import {
  actionsRequired,
  levelBreakdown,
  levelForXp,
  MAX_LEVEL,
  MAX_XP,
  planXpGoal,
  XP_AT_MAX_LEVEL,
  xpForLevel,
} from '@/lib/skilling/xp';

/**
 * ORGANISM — the XP calculator.
 *
 * Owns inputs, calls the domain logic in `lib/skilling/xp.ts`, and renders the
 * result. It contains no maths of its own; every number on screen comes from a
 * pure function that is unit tested without rendering (components/README.md #3).
 *
 * This is where `"use client"` belongs — the smallest thing that genuinely needs
 * state. The page rendering it stays a server component.
 *
 * The hiscores prefill is strictly optional: remove the network and every other
 * control still works, which is why the RSN box is a separate, clearly labelled
 * convenience rather than a required first step.
 */

type TargetMode = 'level' | 'xp';
type CurrentMode = 'xp' | 'level';
type LookupState =
  { status: 'idle' } | { status: 'loading' } | { status: 'error'; message: string };

interface HiscoreApiSkill {
  name: string;
  level: number;
  xp: number;
}

export function XpCalculator() {
  const [skill, setSkill] = useState<string>('Fletching');
  const [currentMode, setCurrentMode] = useState<CurrentMode>('xp');
  const [currentInput, setCurrentInput] = useState('');
  const [targetMode, setTargetMode] = useState<TargetMode>('level');
  const [targetInput, setTargetInput] = useState('99');
  const [xpPerActionInput, setXpPerActionInput] = useState('');

  const [rsn, setRsn] = useState('');
  const [lookup, setLookup] = useState<LookupState>({ status: 'idle' });

  const parsedCurrent = parseCount(currentInput);
  const parsedTarget = parseCount(targetInput);
  const parsedXpPerAction = parseCount(xpPerActionInput);

  const currentXp = useMemo(() => {
    if (parsedCurrent === null) return null;
    return currentMode === 'xp' ? parsedCurrent : xpForLevel(parsedCurrent);
  }, [parsedCurrent, currentMode]);

  const goal = useMemo(() => {
    if (currentXp === null || parsedTarget === null) return null;
    return planXpGoal({
      currentXp,
      target:
        targetMode === 'level'
          ? { kind: 'level', level: parsedTarget }
          : { kind: 'xp', xp: parsedTarget },
    });
  }, [currentXp, parsedTarget, targetMode]);

  const actions =
    goal && parsedXpPerAction !== null
      ? actionsRequired(goal.xpRemaining, parsedXpPerAction)
      : null;

  const breakdown = goal ? levelBreakdown(goal.currentLevel, goal.targetLevel) : [];

  // Distinguishes "you have not typed anything yet" from "what you typed is not
  // a number". Blank is not an error state — showing a red message on an empty
  // form is noise.
  const currentError =
    currentInput.trim() !== '' && parsedCurrent === null
      ? 'Enter a number. 1,000 / 1k / 1.5m all work.'
      : undefined;

  const targetError =
    targetInput.trim() !== '' && parsedTarget === null
      ? 'Enter a number. 1,000 / 1k / 1.5m all work.'
      : targetMode === 'level' && parsedTarget !== null && parsedTarget > MAX_LEVEL
        ? `${MAX_LEVEL} is the highest level. Switch to "target XP" to aim past it.`
        : goal?.problem === 'target-below-current'
          ? 'Your target is lower than where you already are.'
          : goal?.problem === 'target-equals-current'
            ? 'You are already there.'
            : undefined;

  const xpPerActionError =
    xpPerActionInput.trim() !== '' && parsedXpPerAction === null
      ? 'Enter a number, or leave blank to skip.'
      : undefined;

  async function handleLookup() {
    const name = rsn.trim();
    if (name === '') return;

    setLookup({ status: 'loading' });

    try {
      const response = await fetch(
        `/api/skilling/hiscores?rsn=${encodeURIComponent(name)}`,
      );
      const body: unknown = await response.json();

      if (response.status === 400) {
        setLookup({
          status: 'error',
          message: 'Names are 1-12 letters, digits, spaces or hyphens.',
        });
        return;
      }

      if (response.status === 429) {
        setLookup({
          status: 'error',
          message: 'Too many lookups just now — wait a minute and try again.',
        });
        return;
      }

      if (!response.ok) {
        setLookup({
          status: 'error',
          message: 'The hiscores are not answering. Type your XP in manually.',
        });
        return;
      }

      const result = body as { status?: string; skills?: HiscoreApiSkill[] };

      // Not being on the hiscores is normal — anyone low-level or new is
      // absent. It is stated plainly, not dressed up as a failure.
      if (result.status !== 'found' || !Array.isArray(result.skills)) {
        setLookup({
          status: 'error',
          message: `No hiscores entry for "${name}". New and low-level accounts are not listed.`,
        });
        return;
      }

      const match = result.skills.find(
        (entry) => entry.name.toLowerCase() === skill.toLowerCase(),
      );

      if (!match) {
        setLookup({ status: 'error', message: `No ${skill} data for "${name}".` });
        return;
      }

      setCurrentMode('xp');
      setCurrentInput(String(match.xp));
      setLookup({ status: 'idle' });
    } catch {
      setLookup({
        status: 'error',
        message: 'The lookup failed. Type your XP in manually.',
      });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          id="xp-skill"
          label="Skill"
          value={skill}
          onChange={setSkill}
          options={SKILL_OPTIONS}
          hint="Used for the hiscores lookup and the labels below."
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="xp-rsn" className="text-sm font-medium text-content">
            Look up current XP (optional)
          </label>
          <div className="flex items-center gap-2">
            <Input
              id="xp-rsn"
              type="text"
              autoComplete="off"
              maxLength={12}
              placeholder="Display name"
              value={rsn}
              aria-describedby="xp-rsn-hint"
              onChange={(event) => setRsn(event.target.value)}
            />
            <Button
              variant="secondary"
              onClick={handleLookup}
              disabled={lookup.status === 'loading' || rsn.trim() === ''}
            >
              {lookup.status === 'loading' ? 'Looking up…' : 'Look up'}
            </Button>
          </div>
          <p id="xp-rsn-hint" className="text-xs text-content-subtle">
            Everything here works without this — it only saves typing.
          </p>
          {lookup.status === 'error' ? (
            <p role="alert" className="text-xs text-danger">
              {lookup.message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <ModeToggle
            label="Current"
            value={currentMode}
            options={[
              { value: 'xp', label: 'XP' },
              { value: 'level', label: 'Level' },
            ]}
            onChange={(next) => setCurrentMode(next as CurrentMode)}
          />
          <NumericField
            id="xp-current"
            label={
              currentMode === 'xp' ? `Current ${skill} XP` : `Current ${skill} level`
            }
            value={currentInput}
            onChange={setCurrentInput}
            error={currentError}
            placeholder={currentMode === 'xp' ? '737,627' : '70'}
            suffix={
              currentXp !== null && currentMode === 'xp'
                ? `lvl ${levelForXp(currentXp)}`
                : currentXp !== null
                  ? `${formatCount(currentXp)} xp`
                  : undefined
            }
          />
        </div>

        <div className="flex flex-col gap-2">
          <ModeToggle
            label="Target"
            value={targetMode}
            options={[
              { value: 'level', label: 'Level' },
              { value: 'xp', label: 'XP' },
            ]}
            onChange={(next) => setTargetMode(next as TargetMode)}
          />
          <NumericField
            id="xp-target"
            label={
              targetMode === 'level' ? `Target ${skill} level` : `Target ${skill} XP`
            }
            value={targetInput}
            onChange={setTargetInput}
            error={targetError}
            placeholder={targetMode === 'level' ? '99' : '50,000,000'}
            suffix={
              parsedTarget !== null && targetMode === 'level'
                ? `${formatCount(xpForLevel(parsedTarget))} xp`
                : parsedTarget !== null
                  ? `lvl ${levelForXp(parsedTarget)}`
                  : undefined
            }
          />
        </div>
      </div>

      <NumericField
        id="xp-per-action"
        label="XP per action (optional)"
        value={xpPerActionInput}
        onChange={setXpPerActionInput}
        error={xpPerActionError}
        placeholder="75"
        hint="One yew longbow, one bone, one lap. Action counts always round up."
      />

      <section aria-labelledby="xp-results-heading" className="flex flex-col gap-3">
        <h2 id="xp-results-heading" className="text-sm font-semibold text-content">
          Result
        </h2>

        {goal === null ? (
          <p className="text-sm text-content-muted">
            Enter your current {currentMode === 'xp' ? 'XP' : 'level'} and a target to see
            what is left.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <StatBadge label="Current level" value={goal.currentLevel} />
              <StatBadge label="Target level" value={goal.targetLevel} tone="info" />
              <StatBadge
                label="XP remaining"
                value={formatCount(goal.xpRemaining)}
                tone={goal.xpRemaining > 0 ? 'warning' : 'success'}
              />
              {actions !== null ? (
                <StatBadge label="Actions" value={formatCount(actions)} tone="info" />
              ) : null}
            </div>

            {goal.currentXp >= XP_AT_MAX_LEVEL && goal.currentXp < MAX_XP ? (
              <p className="text-sm text-content-muted">
                Level {MAX_LEVEL} already. The XP ceiling is{' '}
                <span className="tabular">{formatCount(MAX_XP)}</span>, so there is still{' '}
                <span className="tabular">{formatCount(MAX_XP - goal.currentXp)}</span> XP
                to gain — switch the target to XP to plan past 99.
              </p>
            ) : null}

            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell numeric>Level</TableHeaderCell>
                  <TableHeaderCell numeric>XP at level</TableHeaderCell>
                  <TableHeaderCell numeric>XP for this level</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {breakdown.length === 0 ? (
                  <TableEmptyRow colSpan={3}>
                    No levels between here and your target.
                  </TableEmptyRow>
                ) : (
                  breakdown.map((row) => (
                    <TableRow key={row.level}>
                      <TableCell numeric>{row.level}</TableCell>
                      <TableCell numeric>{formatCount(row.xpAtLevel)}</TableCell>
                      <TableCell numeric>{formatCount(row.xpFromPrevious)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </>
        )}
      </section>
    </div>
  );
}

/** A small radio group. Kept local — nothing else in the slice needs it yet. */
function ModeToggle({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label={`${label} input mode`} className="flex gap-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={
            value === option.value
              ? 'rounded-control bg-primary px-2 py-1 text-2xs font-medium text-primary-content'
              : 'rounded-control bg-surface-sunken px-2 py-1 text-2xs font-medium text-content-muted hover:bg-surface-hover'
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
