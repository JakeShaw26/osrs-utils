'use client';

import { useMemo } from 'react';
import { StatBadge } from '@/components/atoms/StatBadge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/components/atoms/Table';
import { BlockerList } from '@/components/molecules/quests/BlockerList';
import { SelfReportedNotice } from '@/components/molecules/quests/SelfReportedNotice';
import { LevelEntryPanel } from './LevelEntryPanel';
import { useQuestProfile } from './use-quest-profile';
import { DIARIES, QUEST_GRAPH } from '@/lib/quests';
import { earnedQuestPoints, solveDiaries } from '@/lib/quests/solver';

/**
 * ORGANISM — which achievement diary tiers your levels could complete.
 *
 * Same shape as the quest planner and for the same reason: diaries are absent
 * from the hiscores (verified), so completion is member-declared while
 * *achievability* is computable from levels. This tool only does the second.
 *
 * It shares `useQuestProfile` with the planner, so levels typed on either page
 * are available on the other — the same browser-local profile, not a copy.
 */

export function DiaryChecker() {
  const profile = useQuestProfile();

  const questPoints = useMemo(
    () => earnedQuestPoints(QUEST_GRAPH, profile.completed),
    [profile.completed],
  );

  const statuses = useMemo(
    () => solveDiaries(DIARIES, profile.levels, questPoints),
    [profile.levels, questPoints],
  );

  const achievable = statuses.filter((status) => status.achievable).length;

  return (
    <div className="flex flex-col gap-8">
      <SelfReportedNotice subject="diary completions">
        This page shows what your levels make{' '}
        <strong className="font-medium text-content">achievable</strong>, not what you
        have finished.
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

      <section aria-labelledby="diaries-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="diaries-heading" className="text-lg font-semibold text-content">
            Achievement diaries
          </h2>
          <div className="flex flex-wrap gap-2">
            <StatBadge label="Quest points" value={questPoints} tone="warning" />
            <StatBadge
              label="Tiers achievable"
              value={`${achievable} / ${statuses.length}`}
              tone="success"
            />
          </div>
        </div>

        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Diary</TableHeaderCell>
              <TableHeaderCell>Tier</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Missing</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {statuses.map((status) => (
              <TableRow key={`${status.diary.id}-${status.tier.tier}`}>
                <TableCell>{status.diary.name}</TableCell>
                <TableCell>{status.tier.tier}</TableCell>
                <TableCell>
                  <StatBadge
                    value={status.achievable ? 'Levels met' : 'Not yet'}
                    tone={status.achievable ? 'success' : 'neutral'}
                  />
                </TableCell>
                <TableCell>
                  {status.blockers.length === 0 ? (
                    <span className="text-sm text-content-subtle">
                      Nothing we can check
                    </span>
                  ) : (
                    <BlockerList blockers={status.blockers.slice(0, 6)} />
                  )}
                  {status.blockers.length > 6 ? (
                    <span className="ml-1 text-xs text-content-subtle">
                      +{status.blockers.length - 6} more
                    </span>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <p className="text-sm text-content-muted">
          Requirements are the levels needed to finish <em>every</em> task in the tier,
          from the OSRS Wiki&rsquo;s own summary tables. Ironman-only requirements are
          excluded. Diary tasks are also frequently gated by specific quests, which this
          checker does not model — so a tier shown as achievable may still need a quest
          first.
        </p>
      </section>
    </div>
  );
}
