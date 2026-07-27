'use client';

import { useMemo, useState } from 'react';
import { Select } from '@/components/atoms/Select';
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
import { BlockerList } from '@/components/molecules/quests/BlockerList';
import { SelfReportedNotice } from '@/components/molecules/quests/SelfReportedNotice';
import { LevelEntryPanel } from './LevelEntryPanel';
import { ProfileBackup } from './ProfileBackup';
import { useQuestProfile } from './use-quest-profile';
import { QUEST_GRAPH, QUEST_COVERAGE } from '@/lib/quests';
import { earnedQuestPoints, planFor, solveQuests } from '@/lib/quests/solver';
import type { QuestState, QuestStatus } from '@/lib/quests/types';

/**
 * ORGANISM — "what can I do now?".
 *
 * The whole tool in one place, because levels, declared completions and the
 * answer are one loop: ticking a quest changes the quest-point total, which
 * unlocks other quests immediately. Splitting the state across pages would
 * make that feedback invisible.
 *
 * Every number here is derived by the pure solver in `lib/quests`. This
 * component decides what to show, never what is achievable — which is what
 * makes the interesting logic testable without rendering anything.
 */

const FILTERS = [
  { value: 'available', label: 'Can start now' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'declared-complete', label: 'Marked complete' },
  { value: 'all', label: 'All' },
] as const;

type Filter = (typeof FILTERS)[number]['value'];

const STATE_TONE: Record<QuestState, 'success' | 'warning' | 'neutral'> = {
  available: 'success',
  blocked: 'warning',
  'declared-complete': 'neutral',
};

const STATE_LABEL: Record<QuestState, string> = {
  available: 'Can start',
  blocked: 'Blocked',
  'declared-complete': 'Marked done',
};

export function QuestPlanner() {
  const profile = useQuestProfile();
  const [filter, setFilter] = useState<Filter>('available');
  const [expanded, setExpanded] = useState<string | null>(null);

  const statuses = useMemo(
    () => solveQuests(QUEST_GRAPH, profile.levels, profile.completed),
    [profile.levels, profile.completed],
  );

  const questPoints = useMemo(
    () => earnedQuestPoints(QUEST_GRAPH, profile.completed),
    [profile.completed],
  );

  const counts = useMemo(() => {
    const tally = { available: 0, blocked: 0, 'declared-complete': 0 };
    for (const status of statuses) tally[status.state] += 1;
    return tally;
  }, [statuses]);

  const visible = useMemo(
    () => (filter === 'all' ? statuses : statuses.filter((s) => s.state === filter)),
    [statuses, filter],
  );

  const plan = useMemo(
    () =>
      expanded ? planFor(QUEST_GRAPH, expanded, profile.levels, profile.completed) : null,
    [expanded, profile.levels, profile.completed],
  );

  return (
    <div className="flex flex-col gap-8">
      <SelfReportedNotice subject="quest completions">
        Levels, by contrast, are real — type them in or load them from the hiscores.
      </SelfReportedNotice>

      <LevelEntryPanel
        drafts={profile.drafts}
        levels={profile.levels}
        levelErrors={profile.levelErrors}
        rsn={profile.rsn}
        onRsnChange={profile.setRsn}
        onLevelChange={profile.setLevel}
        onLevelsLoaded={profile.setAllLevels}
        onClear={profile.clearLevels}
      />

      {!profile.persisted ? (
        <p className="text-sm text-warning">
          This browser is not saving your progress — storage is unavailable or full.
          Export a copy before you close the tab.
        </p>
      ) : null}

      <section aria-labelledby="results-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="results-heading" className="text-lg font-semibold text-content">
            Quests
          </h2>
          <div className="flex flex-wrap gap-2">
            <StatBadge label="Quest points" value={questPoints} tone="warning" />
            <StatBadge label="Can start" value={counts.available} tone="success" />
            <StatBadge label="Blocked" value={counts.blocked} tone="neutral" />
          </div>
        </div>

        <div className="flex max-w-64 flex-col gap-1">
          <label
            htmlFor="quest-filter"
            className="text-2xs font-medium tracking-wide text-content-subtle uppercase"
          >
            Show
          </label>
          <Select
            id="quest-filter"
            value={filter}
            onChange={(event) => setFilter(event.target.value as Filter)}
            options={FILTERS.map((f) => ({ value: f.value, label: f.label }))}
          />
        </div>

        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Done</TableHeaderCell>
              <TableHeaderCell>Quest</TableHeaderCell>
              <TableHeaderCell numeric>QP</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Missing</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.length === 0 ? (
              <TableEmptyRow colSpan={5}>
                No quests match this filter. Try “All”, or enter more levels above.
              </TableEmptyRow>
            ) : (
              visible.map((status) => (
                <QuestRow
                  key={status.quest.id}
                  status={status}
                  declared={profile.completed.has(status.quest.id)}
                  expanded={expanded === status.quest.id}
                  onToggleDeclared={() => profile.toggleCompleted(status.quest.id)}
                  onToggleExpanded={() =>
                    setExpanded((current) =>
                      current === status.quest.id ? null : status.quest.id,
                    )
                  }
                />
              ))
            )}
          </TableBody>
        </Table>

        {plan && plan.questsToComplete.length > 0 ? (
          <div className="rounded-card border border-border bg-surface-sunken p-4">
            <h3 className="font-medium text-content">Getting to {plan.target.name}</h3>
            <p className="mt-1 text-sm text-content-muted">
              {plan.questsToComplete.length} quest
              {plan.questsToComplete.length === 1 ? '' : 's'} first, in this order — worth{' '}
              <span className="tabular">{plan.questPointsGained}</span> quest points along
              the way.
            </p>
            <ol className="mt-2 list-decimal pl-5 text-sm text-content">
              {plan.questsToComplete.map((quest) => (
                <li key={quest.id}>{quest.name}</li>
              ))}
            </ol>
            {Object.keys(plan.skillsNeeded).length > 0 ? (
              <p className="mt-2 text-sm text-content-muted">
                Highest levels needed across the chain:{' '}
                <span className="tabular">
                  {Object.entries(plan.skillsNeeded)
                    .map(([skill, level]) => `${skill} ${level}`)
                    .join(', ')}
                </span>
              </p>
            ) : null}
          </div>
        ) : null}

        <p className="text-sm text-content-muted">
          Covering <span className="tabular">{QUEST_COVERAGE.modelled}</span> of{' '}
          <span className="tabular">{QUEST_COVERAGE.inGame}</span> quests — every
          free-to-play quest plus the members&rsquo; quests that gate others. A quest
          missing from this list is not modelled, not unavailable.
        </p>
      </section>

      <ProfileBackup profile={profile.profile} onImport={profile.replaceProfile} />
    </div>
  );
}

interface QuestRowProps {
  status: QuestStatus;
  declared: boolean;
  expanded: boolean;
  onToggleDeclared: () => void;
  onToggleExpanded: () => void;
}

function QuestRow({
  status,
  declared,
  expanded,
  onToggleDeclared,
  onToggleExpanded,
}: QuestRowProps) {
  const { quest } = status;

  return (
    <>
      <TableRow>
        <TableCell>
          <input
            type="checkbox"
            checked={declared}
            onChange={onToggleDeclared}
            aria-label={`Mark ${quest.name} complete`}
            className="size-4 accent-primary"
          />
        </TableCell>
        <TableCell>
          <button
            type="button"
            onClick={onToggleExpanded}
            aria-expanded={expanded}
            className="text-left font-medium text-content hover:text-primary"
          >
            {quest.name}
          </button>
          <span className="ml-2 text-xs text-content-subtle">
            {quest.members ? 'Members' : 'Free'} · {quest.difficulty}
            {quest.miniquest ? ' · Miniquest' : ''}
          </span>
        </TableCell>
        <TableCell numeric>{quest.questPoints}</TableCell>
        <TableCell>
          <StatBadge value={STATE_LABEL[status.state]} tone={STATE_TONE[status.state]} />
        </TableCell>
        <TableCell>
          <BlockerList blockers={status.blockers} boostable={quest.boostable} />
        </TableCell>
      </TableRow>

      {expanded ? (
        <TableRow>
          <TableCell colSpan={5}>
            <div className="flex flex-col gap-2 text-sm text-content-muted">
              <p>
                {quest.length} · {quest.difficulty}
                {quest.requirements.questPoints !== undefined ? (
                  <>
                    {' '}
                    · needs{' '}
                    <span className="tabular">{quest.requirements.questPoints}</span>{' '}
                    quest points to start
                  </>
                ) : null}
              </p>
              {quest.notes?.length ? (
                <ul className="list-disc pl-5">
                  {quest.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              ) : null}
              {quest.otherRequirements?.length ? (
                <div>
                  <p className="font-medium text-content">
                    Not checked by this tool — read before you start:
                  </p>
                  <ul className="list-disc pl-5">
                    {quest.otherRequirements.map((requirement) => (
                      <li key={requirement}>{requirement}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <a
                className="text-primary underline"
                href={`https://oldschool.runescape.wiki/w/${encodeURIComponent(quest.name)}`}
                target="_blank"
                rel="noreferrer"
              >
                Read the quest guide on the OSRS Wiki
              </a>
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}
