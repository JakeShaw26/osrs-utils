'use client';

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import type { QuestProfile } from '@/lib/quests/profile';
import {
  getProfileServerSnapshot,
  getProfileSnapshot,
  parseSnapshot,
  subscribeToProfile,
  writeProfile,
} from '@/lib/quests/profile-store';
import { parseLevel } from '@/lib/quests/levels';
import { SKILLS, type PlayerLevels, type SkillName } from '@/lib/quests/types';

/**
 * The member's levels and declared completions, persisted to their browser.
 *
 * TWO KINDS OF STATE, AND THE DIFFERENCE MATTERS
 *
 *  - **The saved profile** lives in `localStorage` and is read through
 *    `useSyncExternalStore` (see `lib/quests/profile-store.ts` for why not an
 *    effect). Every mutator writes through immediately, inside the event
 *    handler that caused it.
 *  - **Level drafts** are the raw text in the boxes, held only in React. This
 *    is what lets an invalid entry stay on screen with a message beside it:
 *    parsing to a number on every keystroke would silently discard "1,000"
 *    and leave the member staring at an empty box. Only valid entries are
 *    persisted, and only valid entries reach the solver.
 *
 * Drafts layer over the saved levels rather than replacing them, so a field
 * the member has not touched still shows what was loaded from the hiscores.
 */

export type LevelDrafts = Partial<Record<SkillName, string>>;

function draftsFrom(levels: PlayerLevels): LevelDrafts {
  const drafts: LevelDrafts = {};
  for (const skill of SKILLS) {
    const level = levels[skill];
    if (level !== undefined) drafts[skill] = String(level);
  }
  return drafts;
}

/** Only valid entries become levels; invalid and empty ones are simply absent. */
function parseDrafts(drafts: LevelDrafts): {
  levels: PlayerLevels;
  errors: Partial<Record<SkillName, string>>;
} {
  const levels: PlayerLevels = {};
  const errors: Partial<Record<SkillName, string>> = {};

  for (const skill of SKILLS) {
    const draft = drafts[skill];
    if (draft === undefined) continue;
    const result = parseLevel(draft, skill);
    if (result.ok) levels[skill] = result.level;
    // "empty" is a cleared field, not a mistake worth shouting about.
    else if (result.reason !== 'empty') errors[skill] = result.reason;
  }

  return { levels, errors };
}

export interface QuestProfileState {
  drafts: LevelDrafts;
  levels: PlayerLevels;
  levelErrors: Partial<Record<SkillName, string>>;
  completed: ReadonlySet<string>;
  rsn: string;
  /** False when the last write to localStorage failed. */
  persisted: boolean;
  profile: QuestProfile;
  setLevel: (skill: SkillName, value: string) => void;
  setAllLevels: (levels: PlayerLevels) => void;
  clearLevels: () => void;
  toggleCompleted: (questId: string) => void;
  setRsn: (rsn: string) => void;
  replaceProfile: (profile: QuestProfile) => void;
}

export function useQuestProfile(): QuestProfileState {
  const raw = useSyncExternalStore(
    subscribeToProfile,
    getProfileSnapshot,
    getProfileServerSnapshot,
  );

  const saved = useMemo(() => parseSnapshot(raw), [raw]);

  const [overrides, setOverrides] = useState<LevelDrafts>({});
  const [persisted, setPersisted] = useState(true);

  const drafts = useMemo(
    () => ({ ...draftsFrom(saved.levels), ...overrides }),
    [saved.levels, overrides],
  );

  const { levels, errors: levelErrors } = useMemo(() => parseDrafts(drafts), [drafts]);

  const completed = useMemo(() => new Set(saved.completed), [saved.completed]);

  const profile = useMemo<QuestProfile>(
    () => ({ levels, completed: saved.completed, rsn: saved.rsn }),
    [levels, saved.completed, saved.rsn],
  );

  const persist = useCallback((next: QuestProfile) => {
    setPersisted(writeProfile(next));
  }, []);

  const setLevel = useCallback(
    (skill: SkillName, value: string) => {
      const next = { ...overrides, [skill]: value };
      setOverrides(next);

      // Persist from the merged view so an untouched field is not dropped.
      const merged = { ...draftsFrom(saved.levels), ...next };
      setPersisted(writeProfile({ ...saved, levels: parseDrafts(merged).levels }));
    },
    [overrides, saved],
  );

  const setAllLevels = useCallback(
    (next: PlayerLevels) => {
      // Drop drafts so the loaded levels are what the boxes show.
      setOverrides({});
      persist({ ...saved, levels: next });
    },
    [saved, persist],
  );

  const clearLevels = useCallback(() => {
    setOverrides({});
    persist({ ...saved, levels: {} });
  }, [saved, persist]);

  const toggleCompleted = useCallback(
    (questId: string) => {
      const next = new Set(saved.completed);
      if (!next.delete(questId)) next.add(questId);
      persist({ ...saved, completed: [...next] });
    },
    [saved, persist],
  );

  const setRsn = useCallback(
    (rsn: string) => persist({ ...saved, rsn: rsn || undefined }),
    [saved, persist],
  );

  const replaceProfile = useCallback(
    (next: QuestProfile) => {
      setOverrides({});
      persist(next);
    },
    [persist],
  );

  return {
    drafts,
    levels,
    levelErrors,
    completed,
    rsn: saved.rsn ?? '',
    persisted,
    profile,
    setLevel,
    setAllLevels,
    clearLevels,
    toggleCompleted,
    setRsn,
    replaceProfile,
  };
}
