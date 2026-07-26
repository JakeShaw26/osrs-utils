'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/atoms/Input';
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
import { skillLabel } from '@/components/molecules/quests/BlockerList';
import type { Quest } from '@/lib/quests/types';

/**
 * ORGANISM — browse and search the modelled quests and their requirements.
 *
 * Read-only and stateless beyond its filters: this answers "what does this
 * quest need", where the planner answers "what can I do". Keeping them apart
 * means the index is useful without entering a single level.
 *
 * Filtering happens in the browser over data passed in as props. The dataset
 * is small and static, so shipping it and filtering locally is both faster and
 * simpler than a round trip per keystroke — and it keeps this organism free of
 * fetching.
 */

const MEMBERSHIP = [
  { value: 'all', label: 'All quests' },
  { value: 'free', label: 'Free-to-play' },
  { value: 'members', label: 'Members' },
] as const;

type Membership = (typeof MEMBERSHIP)[number]['value'];

interface QuestIndexProps {
  quests: readonly Quest[];
  /** Names of every quest, for resolving prerequisite ids to labels. */
  namesById: Readonly<Record<string, string>>;
}

export function QuestIndex({ quests, namesById }: QuestIndexProps) {
  const [search, setSearch] = useState('');
  const [membership, setMembership] = useState<Membership>('all');

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return quests.filter((quest) => {
      if (membership === 'free' && quest.members) return false;
      if (membership === 'members' && !quest.members) return false;
      if (needle === '') return true;
      return quest.name.toLowerCase().includes(needle);
    });
  }, [quests, search, membership]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-56 flex-1 flex-col gap-1">
          <label
            htmlFor="quest-search"
            className="text-2xs font-medium tracking-wide text-content-subtle uppercase"
          >
            Search quests
          </label>
          <Input
            id="quest-search"
            type="search"
            value={search}
            placeholder="Dragon Slayer"
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="flex min-w-40 flex-col gap-1">
          <label
            htmlFor="quest-membership"
            className="text-2xs font-medium tracking-wide text-content-subtle uppercase"
          >
            Membership
          </label>
          <Select
            id="quest-membership"
            value={membership}
            onChange={(event) => setMembership(event.target.value as Membership)}
            options={MEMBERSHIP.map((m) => ({ value: m.value, label: m.label }))}
          />
        </div>
      </div>

      <p className="text-sm text-content-muted" aria-live="polite">
        Showing <span className="tabular">{visible.length}</span> of{' '}
        <span className="tabular">{quests.length}</span> modelled quests.
      </p>

      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Quest</TableHeaderCell>
            <TableHeaderCell numeric>QP</TableHeaderCell>
            <TableHeaderCell>Skills</TableHeaderCell>
            <TableHeaderCell>Prerequisites</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {visible.length === 0 ? (
            <TableEmptyRow colSpan={4}>
              No modelled quest matches “{search}”. It may exist in game but not yet be in
              this dataset.
            </TableEmptyRow>
          ) : (
            visible.map((quest) => (
              <TableRow key={quest.id}>
                <TableCell>
                  <a
                    className="font-medium text-content hover:text-primary"
                    href={`https://oldschool.runescape.wiki/w/${encodeURIComponent(quest.name)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {quest.name}
                  </a>
                  <span className="ml-2 text-xs text-content-subtle">
                    {quest.members ? 'Members' : 'Free'} · {quest.difficulty} ·{' '}
                    {quest.length}
                  </span>
                </TableCell>
                <TableCell numeric>{quest.questPoints}</TableCell>
                <TableCell>
                  <ul className="flex flex-wrap gap-1.5">
                    {quest.requirements.questPoints !== undefined ? (
                      <li>
                        <StatBadge
                          label="Quest points"
                          value={quest.requirements.questPoints}
                          tone="warning"
                        />
                      </li>
                    ) : null}
                    {Object.entries(quest.requirements.skills ?? {}).map(
                      ([skill, level]) => (
                        <li key={skill}>
                          <StatBadge
                            label={skillLabel(skill as never)}
                            value={level}
                            tone="neutral"
                          />
                        </li>
                      ),
                    )}
                  </ul>
                </TableCell>
                <TableCell>
                  {quest.requirements.quests?.length ? (
                    <span className="text-sm text-content-muted">
                      {quest.requirements.quests
                        .map((id) => namesById[id] ?? id)
                        .join(', ')}
                    </span>
                  ) : (
                    <span className="text-sm text-content-subtle">None</span>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
