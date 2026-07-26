'use client';

import { useId, useState } from 'react';
import { Input } from '@/components/atoms/Input';
import { Select } from '@/components/atoms/Select';
import { StatBadge } from '@/components/atoms/StatBadge';
import { formatDurationLong } from '@/lib/utility/duration';
import {
  DEFAULT_MINIGAME,
  MINIGAMES,
  MINIGAME_DATA_VERSION,
  estimateMs,
  findMinigameOrDefault,
  runsNeeded,
} from '@/lib/utility/minigames';
import { parseGpInput, parseRateInput } from '@/lib/utility/parse';

/**
 * ORGANISM — minigame point calculator.
 *
 * All three point tables are authored data with a stated confidence, and the
 * component **renders that confidence** rather than presenting every row with
 * equal authority (ADR-0019). A calculator that looks equally sure about a
 * transcribed wiki table and a half-remembered ticket count is the failure mode
 * this design is guarding against.
 *
 * The arithmetic — `runsNeeded`, `estimateMs` — is in `lib/utility/minigames.ts`
 * and unit-tested there, including the cases that produce `null` rather than
 * `Infinity` or `NaN`.
 */

const CONFIDENCE_COPY = {
  documented: null,
  community: 'Player-reported, not from a primary source. Check before committing hours.',
  unverified: 'Not confirmed. Treat as a rough guide only.',
} as const;

export function MinigamePointsCalculator() {
  const ids = useId();
  const [minigameId, setMinigameId] = useState(DEFAULT_MINIGAME.id);
  const minigame = findMinigameOrDefault(minigameId);

  const [modeId, setModeId] = useState(minigame.modes[0].id);
  const [currentRaw, setCurrentRaw] = useState('0');
  const [targetRaw, setTargetRaw] = useState('');
  const [rateRaw, setRateRaw] = useState(String(minigame.defaultRunsPerHour));

  const mode = minigame.modes.find((entry) => entry.id === modeId) ?? minigame.modes[0];

  const current = parseGpInput(currentRaw) ?? 0;
  const target = parseGpInput(targetRaw);
  const rate = parseRateInput(rateRaw);

  const targetInvalid = targetRaw.trim() !== '' && target === null;
  const rateInvalid = rateRaw.trim() !== '' && rate === null;

  const runs = target === null ? null : runsNeeded(mode.pointsPerRun, target, current);
  const durationMs = runs === null || rate === null ? null : estimateMs(runs, rate);

  function pickMinigame(id: string) {
    const next = findMinigameOrDefault(id);
    setMinigameId(next.id);
    // Modes are per-minigame, so a stale id would silently fall back to the
    // first mode and quietly change the answer under the user.
    setModeId(next.modes[0].id);
    setRateRaw(String(next.defaultRunsPerHour));
  }

  const confidenceCopy = CONFIDENCE_COPY[minigame.confidence];

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`${ids}-minigame`}
            className="mb-1 block text-sm text-content-muted"
          >
            Minigame
          </label>
          <Select
            id={`${ids}-minigame`}
            value={minigameId}
            onChange={(event) => pickMinigame(event.target.value)}
            options={MINIGAMES.map((entry) => ({
              value: entry.id,
              label: entry.name,
            }))}
          />
        </div>

        <div>
          <label
            htmlFor={`${ids}-mode`}
            className="mb-1 block text-sm text-content-muted"
          >
            Result per {minigame.runNoun}
          </label>
          <Select
            id={`${ids}-mode`}
            value={mode.id}
            onChange={(event) => setModeId(event.target.value)}
            options={minigame.modes.map((entry) => ({
              value: entry.id,
              label: `${entry.label} — ${entry.pointsPerRun} pts`,
            }))}
          />
        </div>

        <div>
          <label
            htmlFor={`${ids}-current`}
            className="mb-1 block text-sm text-content-muted"
          >
            Points you already have
          </label>
          <Input
            id={`${ids}-current`}
            numeric
            value={currentRaw}
            onChange={(event) => setCurrentRaw(event.target.value)}
          />
        </div>

        <div>
          <label
            htmlFor={`${ids}-target`}
            className="mb-1 block text-sm text-content-muted"
          >
            Points you want
          </label>
          <Input
            id={`${ids}-target`}
            numeric
            value={targetRaw}
            invalid={targetInvalid}
            aria-describedby={targetInvalid ? `${ids}-target-error` : undefined}
            onChange={(event) => setTargetRaw(event.target.value)}
            placeholder="850"
          />
          {targetInvalid ? (
            <p
              id={`${ids}-target-error`}
              role="alert"
              className="mt-1 text-sm text-danger"
            >
              Enter a number of points.
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor={`${ids}-rate`}
            className="mb-1 block text-sm text-content-muted"
          >
            {minigame.runNoun === 'contract' ? 'Contracts' : 'Games'} per hour
          </label>
          <Input
            id={`${ids}-rate`}
            numeric
            value={rateRaw}
            invalid={rateInvalid}
            aria-describedby={rateInvalid ? `${ids}-rate-error` : undefined}
            onChange={(event) => setRateRaw(event.target.value)}
          />
          {rateInvalid ? (
            <p id={`${ids}-rate-error`} role="alert" className="mt-1 text-sm text-danger">
              Enter a rate above zero.
            </p>
          ) : null}
        </div>
      </div>

      {minigame.targets.length > 0 ? (
        <div>
          <p className="mb-2 text-2xs font-semibold tracking-wide text-content-subtle uppercase">
            Common targets
          </p>
          <div className="flex flex-wrap gap-2">
            {minigame.targets.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setTargetRaw(String(entry.points))}
                className="rounded-control border border-border bg-surface-sunken px-3 py-1.5 text-sm text-content transition-colors hover:bg-surface-hover"
              >
                {entry.label} — <span className="tabular">{entry.points}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div
        role="group"
        aria-label="Result"
        className="grid gap-3 rounded-card border border-border bg-surface-sunken p-4"
      >
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-2xs tracking-wide text-content-subtle uppercase">
            {minigame.runNoun === 'contract' ? 'Contracts' : 'Games'} needed
          </span>
          {/* role="status" so the answer is announced when it changes — a
              calculator whose result only appears visually is one a screen
              reader user has to go hunting for after every keystroke. Polite,
              and it changes at typing speed, not sixty times a second. */}
          <span role="status" className="tabular text-3xl font-semibold text-content">
            {runs === null ? '—' : runs}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <StatBadge label="Per run" value={`${mode.pointsPerRun} pts`} tone="info" />
          <StatBadge label="Have" value={current} />
          <StatBadge
            label="Estimated time"
            value={durationMs === null ? '—' : formatDurationLong(durationMs)}
          />
        </div>

        {runs === 0 ? (
          <p className="text-sm text-profit">You already have enough points.</p>
        ) : null}
      </div>

      <div className="grid gap-2 text-sm text-content-muted">
        {minigame.caveats.map((caveat) => (
          <p key={caveat}>{caveat}</p>
        ))}
        {confidenceCopy ? <p className="text-warning">{confidenceCopy}</p> : null}
        <p className="text-2xs text-content-subtle">
          {minigame.source} · Data set {MINIGAME_DATA_VERSION}
        </p>
      </div>
    </div>
  );
}
