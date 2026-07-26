import { resolvePrerequisites, type QuestGraph } from './graph';
import { combatLevel, levelFor, totalLevel } from './levels';
import type {
  AchievementDiary,
  Blocker,
  DeclaredCompletions,
  DiaryTier,
  PlayerLevels,
  Quest,
  QuestStatus,
  SkillName,
} from './types';

/**
 * "What can I do now?" — the part of this feature that is genuinely useful.
 *
 * WHAT THIS DOES AND DOES NOT CLAIM
 *
 * Every answer is of the form "your levels and your declared completions imply
 * you could start this". It is never "you have done this" — completion is not
 * in the hiscores, so declared completions are an unverified assertion by the
 * member and `otherRequirements` (combat ability, a partner, area access) are
 * not evaluated at all. A quest reported as available may still need a fight
 * you cannot win. The UI has to say that; the solver simply refuses to pretend
 * otherwise.
 *
 * Boosts are likewise not applied. A boostable requirement is reported as
 * unmet and flagged as boostable, because whether a member has the potion is
 * not something we can know.
 */

/** Quest points banked from the quests the member says they have finished. */
export function earnedQuestPoints(
  graph: QuestGraph,
  completed: DeclaredCompletions,
): number {
  let total = 0;
  for (const id of completed) total += graph.byId.get(id)?.questPoints ?? 0;
  return total;
}

function skillBlockers(
  required: Readonly<Partial<Record<SkillName, number>>> | undefined,
  levels: PlayerLevels,
): Blocker[] {
  const blockers: Blocker[] = [];
  for (const [skill, needed] of Object.entries(required ?? {}) as [SkillName, number][]) {
    const have = levelFor(levels, skill);
    if (have < needed) blockers.push({ kind: 'skill', skill, required: needed, have });
  }
  return blockers;
}

/**
 * Everything standing between the member and this one quest, right now.
 *
 * Only *direct* prerequisites appear as blockers. A quest blocked because its
 * prerequisite is itself blocked would otherwise list the whole ancestry on
 * every row, which buries the one thing the member can act on. `planFor`
 * exists for when they want the full chain.
 */
export function blockersFor(
  quest: Quest,
  graph: QuestGraph,
  levels: PlayerLevels,
  completed: DeclaredCompletions,
  questPoints = earnedQuestPoints(graph, completed),
): Blocker[] {
  const blockers = skillBlockers(quest.requirements.skills, levels);

  const requiredQp = quest.requirements.questPoints;
  if (requiredQp !== undefined && questPoints < requiredQp) {
    blockers.push({ kind: 'questPoints', required: requiredQp, have: questPoints });
  }

  for (const id of quest.requirements.quests ?? []) {
    if (completed.has(id)) continue;
    blockers.push({
      kind: 'quest',
      questId: id,
      name: graph.byId.get(id)?.name ?? id,
    });
  }

  return blockers;
}

export function statusFor(
  quest: Quest,
  graph: QuestGraph,
  levels: PlayerLevels,
  completed: DeclaredCompletions,
  questPoints = earnedQuestPoints(graph, completed),
): QuestStatus {
  if (completed.has(quest.id)) {
    return { quest, state: 'declared-complete', blockers: [] };
  }

  const blockers = blockersFor(quest, graph, levels, completed, questPoints);
  return {
    quest,
    state: blockers.length === 0 ? 'available' : 'blocked',
    blockers,
  };
}

/** Status of every quest in the graph, in dataset order. */
export function solveQuests(
  graph: QuestGraph,
  levels: PlayerLevels,
  completed: DeclaredCompletions,
): QuestStatus[] {
  // Computed once rather than per quest — otherwise this is quadratic in the
  // number of completed quests for no reason.
  const questPoints = earnedQuestPoints(graph, completed);
  return graph.quests.map((quest) =>
    statusFor(quest, graph, levels, completed, questPoints),
  );
}

export interface QuestPlan {
  readonly target: Quest;
  /**
   * Outstanding prerequisites in an order where each follows its own
   * prerequisites — a to-do list, not just a set.
   */
  readonly questsToComplete: readonly Quest[];
  /** Highest level each skill must reach across the whole chain. */
  readonly skillsNeeded: Readonly<Partial<Record<SkillName, number>>>;
  /** Quest points needed at the tightest point in the chain. */
  readonly questPointsNeeded: number;
  /** Quest points the chain itself awards along the way. */
  readonly questPointsGained: number;
}

/**
 * The full path to one quest — the answer to "what do I actually need for
 * Legends' Quest", which is the question a member has after seeing it blocked.
 *
 * Skill requirements are unioned across every outstanding quest in the chain
 * because they all have to be met eventually; taking only the target's own
 * requirements would understate the work substantially.
 */
export function planFor(
  graph: QuestGraph,
  targetId: string,
  levels: PlayerLevels,
  completed: DeclaredCompletions,
): QuestPlan | null {
  const target = graph.byId.get(targetId);
  if (!target) return null;

  const outstanding = resolvePrerequisites(graph, targetId)
    .filter((id) => !completed.has(id))
    .map((id) => graph.byId.get(id))
    .filter((quest): quest is Quest => quest !== undefined);

  const chain = [...outstanding, target];

  const skillsNeeded: Partial<Record<SkillName, number>> = {};
  let questPointsNeeded = 0;
  let questPointsGained = 0;

  for (const quest of chain) {
    for (const [skill, needed] of Object.entries(quest.requirements.skills ?? {}) as [
      SkillName,
      number,
    ][]) {
      if (levelFor(levels, skill) >= needed) continue;
      skillsNeeded[skill] = Math.max(skillsNeeded[skill] ?? 0, needed);
    }
    questPointsNeeded = Math.max(questPointsNeeded, quest.requirements.questPoints ?? 0);
    if (quest.id !== targetId) questPointsGained += quest.questPoints;
  }

  return {
    target,
    questsToComplete: outstanding,
    skillsNeeded,
    questPointsNeeded,
    questPointsGained,
  };
}

/* --- Achievement diaries -------------------------------------------------- */

export interface DiaryTierStatus {
  readonly diary: AchievementDiary;
  readonly tier: DiaryTier;
  readonly achievable: boolean;
  readonly blockers: readonly Blocker[];
}

/**
 * Whether a diary tier's *skill* requirements are met.
 *
 * Named "achievable", never "complete": diaries are absent from the hiscores,
 * so completion is member-declared. Quest requirements for diary tasks are not
 * modelled, which means an achievable tier can still be gated — stated in the
 * UI rather than hidden.
 */
export function solveDiaryTier(
  diary: AchievementDiary,
  tier: DiaryTier,
  levels: PlayerLevels,
  questPoints: number,
): DiaryTierStatus {
  const blockers = skillBlockers(tier.requirements.skills, levels);

  const { questPoints: qp, combatLevel: cb, totalLevel: total } = tier.requirements;

  if (qp !== undefined && questPoints < qp) {
    blockers.push({ kind: 'questPoints', required: qp, have: questPoints });
  }
  if (cb !== undefined) {
    const have = combatLevel(levels);
    if (have < cb) blockers.push({ kind: 'combatLevel', required: cb, have });
  }
  if (total !== undefined) {
    const have = totalLevel(levels);
    if (have < total) blockers.push({ kind: 'totalLevel', required: total, have });
  }

  return { diary, tier, achievable: blockers.length === 0, blockers };
}

export function solveDiaries(
  diaries: readonly AchievementDiary[],
  levels: PlayerLevels,
  questPoints: number,
): DiaryTierStatus[] {
  return diaries.flatMap((diary) =>
    diary.tiers.map((tier) => solveDiaryTier(diary, tier, levels, questPoints)),
  );
}
