'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { StatBadge } from '@/components/atoms/StatBadge';
import { LevelField } from '@/components/molecules/quests/LevelField';
import { skillLabel } from '@/components/molecules/quests/BlockerList';
import { combatLevel, totalLevel } from '@/lib/quests/levels';
import { SKILLS, type PlayerLevels, type SkillName } from '@/lib/quests/types';

/**
 * ORGANISM — where the member's levels come from.
 *
 * Typing levels is the primary path and always works. The hiscores lookup is a
 * convenience on top of it, never a prerequisite: it needs a server round trip
 * (the hiscores send no CORS header, so a browser cannot call them directly),
 * it can fail, and a brand-new account is not on the hiscores at all. Treating
 * "not found" as an error rather than as an answer would put a red box in
 * front of exactly the members most likely to need a quest planner.
 *
 * This organism fetches, which components/README.md discourages. It is
 * deliberate: the lookup is an interactive action rather than page data, so
 * there is no server render to hoist it into. It calls our own route, never an
 * OSRS API directly (hard rule #1).
 */

interface LevelEntryPanelProps {
  drafts: Partial<Record<SkillName, string>>;
  levels: PlayerLevels;
  levelErrors: Partial<Record<SkillName, string>>;
  rsn: string;
  onRsnChange: (rsn: string) => void;
  onLevelChange: (skill: SkillName, value: string) => void;
  onLevelsLoaded: (levels: PlayerLevels) => void;
  onClear: () => void;
}

type LookupState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; name: string }
  | { status: 'not-found' }
  | { status: 'error'; message: string };

export function LevelEntryPanel({
  drafts,
  levels,
  levelErrors,
  rsn,
  onRsnChange,
  onLevelChange,
  onLevelsLoaded,
  onClear,
}: LevelEntryPanelProps) {
  const [lookup, setLookup] = useState<LookupState>({ status: 'idle' });

  async function loadFromHiscores() {
    if (rsn.trim() === '') return;
    setLookup({ status: 'loading' });

    try {
      const response = await fetch(
        `/quests/api/levels?rsn=${encodeURIComponent(rsn.trim())}`,
      );
      const body = await response.json();

      if (!response.ok) {
        setLookup({ status: 'error', message: body.error ?? 'Lookup failed.' });
        return;
      }
      if (!body.found) {
        setLookup({ status: 'not-found' });
        return;
      }

      onLevelsLoaded(body.levels);
      setLookup({ status: 'loaded', name: body.name });
    } catch {
      setLookup({
        status: 'error',
        message: 'Could not reach the lookup. Enter levels manually.',
      });
    }
  }

  return (
    <section aria-labelledby="levels-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="levels-heading" className="text-lg font-semibold text-content">
          Your levels
        </h2>
        <div className="flex flex-wrap gap-2">
          <StatBadge label="Total" value={totalLevel(levels)} tone="info" />
          <StatBadge label="Combat" value={combatLevel(levels)} tone="info" />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-48 flex-1 flex-col gap-1">
          <label
            htmlFor="rsn"
            className="text-2xs font-medium tracking-wide text-content-subtle uppercase"
          >
            Load from hiscores (optional)
          </label>
          <Input
            id="rsn"
            value={rsn}
            maxLength={12}
            placeholder="Display name"
            onChange={(event) => onRsnChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void loadFromHiscores();
            }}
          />
        </div>
        <Button
          onClick={() => void loadFromHiscores()}
          disabled={rsn.trim() === '' || lookup.status === 'loading'}
        >
          {lookup.status === 'loading' ? 'Looking up…' : 'Load levels'}
        </Button>
        <Button variant="secondary" onClick={onClear}>
          Clear
        </Button>
      </div>

      <p aria-live="polite" className="text-sm text-content-muted">
        {lookup.status === 'loaded' ? `Loaded levels for ${lookup.name}.` : null}
        {lookup.status === 'not-found'
          ? 'That name is not on the hiscores yet. Enter your levels below instead.'
          : null}
        {lookup.status === 'error' ? lookup.message : null}
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {SKILLS.map((skill) => (
          <LevelField
            key={skill}
            label={skillLabel(skill)}
            value={drafts[skill] ?? ''}
            error={levelErrors[skill]}
            onChange={(value) => onLevelChange(skill, value)}
          />
        ))}
      </div>

      <p className="text-sm text-content-muted">
        A skill left blank counts as untrained.
      </p>
    </section>
  );
}
