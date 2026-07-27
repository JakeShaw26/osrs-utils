import { describe, expect, it } from 'vitest';
import { buildQuestGraph } from './graph';
import {
  blockersFor,
  earnedQuestPoints,
  planFor,
  solveDiaryTier,
  solveQuests,
  statusFor,
} from './solver';
import type { AchievementDiary, DiaryTier, Quest } from './types';

/**
 * The solver — "what can I do now".
 *
 * Each blocker kind is tested in isolation (a quest blocked ONLY by quest
 * points, ONLY by a level, ONLY by a prerequisite) because a solver that
 * happens to return "blocked" for the wrong reason is indistinguishable from a
 * correct one when several requirements are unmet at once.
 */

function quest(id: string, overrides: Partial<Quest> = {}): Quest {
  return {
    id,
    name: id,
    members: false,
    questPoints: 1,
    difficulty: 'Novice',
    length: 'Short',
    requirements: {},
    ...overrides,
  };
}

const none = new Set<string>();

describe('earnedQuestPoints', () => {
  it('sums the points of declared completions only', () => {
    const graph = buildQuestGraph([
      quest('a', { questPoints: 3 }),
      quest('b', { questPoints: 5 }),
    ]);

    expect(earnedQuestPoints(graph, new Set(['a']))).toBe(3);
    expect(earnedQuestPoints(graph, new Set(['a', 'b']))).toBe(8);
  });

  it('ignores an id that is not in the dataset', () => {
    const graph = buildQuestGraph([quest('a', { questPoints: 3 })]);

    expect(earnedQuestPoints(graph, new Set(['a', 'not-modelled']))).toBe(3);
  });
});

describe('statusFor', () => {
  it('reports a quest with no requirements as available', () => {
    const graph = buildQuestGraph([quest('a')]);

    expect(statusFor(graph.byId.get('a')!, graph, {}, none).state).toBe('available');
  });

  // "declared-complete", not "complete" — the state name carries the caveat
  // that we cannot verify this, and the UI reads the state name.
  it('reports a declared quest as declared-complete with no blockers', () => {
    const graph = buildQuestGraph([
      quest('a', { requirements: { skills: { mining: 99 } } }),
    ]);

    const status = statusFor(graph.byId.get('a')!, graph, {}, new Set(['a']));

    expect(status.state).toBe('declared-complete');
    expect(status.blockers).toEqual([]);
  });
});

describe('blockersFor', () => {
  it('blocks on a single missing skill level, reporting have and required', () => {
    const graph = buildQuestGraph([
      quest('a', { requirements: { skills: { mining: 10 } } }),
    ]);

    const blockers = blockersFor(graph.byId.get('a')!, graph, { mining: 7 }, none);

    expect(blockers).toEqual([{ kind: 'skill', skill: 'mining', required: 10, have: 7 }]);
  });

  it('does not block when the level is exactly the requirement', () => {
    const graph = buildQuestGraph([
      quest('a', { requirements: { skills: { mining: 10 } } }),
    ]);

    expect(blockersFor(graph.byId.get('a')!, graph, { mining: 10 }, none)).toEqual([]);
  });

  // An absent skill means "not entered", which must read as untrained rather
  // than as "requirement met" — the opposite default would tell a new account
  // it can do everything.
  it('treats an unentered skill as its untrained minimum', () => {
    const graph = buildQuestGraph([
      quest('a', { requirements: { skills: { mining: 10 } } }),
    ]);

    expect(blockersFor(graph.byId.get('a')!, graph, {}, none)).toEqual([
      { kind: 'skill', skill: 'mining', required: 10, have: 1 },
    ]);
  });

  it('knows Hitpoints starts at 10, not 1', () => {
    const graph = buildQuestGraph([
      quest('a', { requirements: { skills: { hitpoints: 10 } } }),
    ]);

    expect(blockersFor(graph.byId.get('a')!, graph, {}, none)).toEqual([]);
  });

  // Below Ice Mountain is the real case: no skill requirement at all, gated
  // purely on 16 banked quest points.
  it('blocks on quest points alone', () => {
    const graph = buildQuestGraph([
      quest('gives-qp', { questPoints: 5 }),
      quest('needs-qp', { requirements: { questPoints: 16 } }),
    ]);

    const blockers = blockersFor(
      graph.byId.get('needs-qp')!,
      graph,
      {},
      new Set(['gives-qp']),
    );

    expect(blockers).toEqual([{ kind: 'questPoints', required: 16, have: 5 }]);
  });

  it('clears the quest-point blocker once enough are declared', () => {
    const graph = buildQuestGraph([
      quest('gives-qp', { questPoints: 20 }),
      quest('needs-qp', { requirements: { questPoints: 16 } }),
    ]);

    expect(
      blockersFor(graph.byId.get('needs-qp')!, graph, {}, new Set(['gives-qp'])),
    ).toEqual([]);
  });

  it('blocks on a missing prerequisite quest, naming it', () => {
    const graph = buildQuestGraph([
      quest('first', { name: 'The First One' }),
      quest('second', { requirements: { quests: ['first'] } }),
    ]);

    expect(blockersFor(graph.byId.get('second')!, graph, {}, none)).toEqual([
      { kind: 'quest', questId: 'first', name: 'The First One' },
    ]);
  });

  // Listing the whole ancestry on every row buries the one thing the member
  // can act on today. planFor() is the place for the full chain.
  it('reports only direct prerequisites, not transitive ones', () => {
    const graph = buildQuestGraph([
      quest('a'),
      quest('b', { requirements: { quests: ['a'] } }),
      quest('c', { requirements: { quests: ['b'] } }),
    ]);

    const blockers = blockersFor(graph.byId.get('c')!, graph, {}, none);

    expect(blockers).toHaveLength(1);
    expect(blockers[0]).toMatchObject({ kind: 'quest', questId: 'b' });
  });

  // otherRequirements exist precisely because they cannot be evaluated. If one
  // ever leaked into the blocker list the tool would claim knowledge it has no
  // basis for.
  it('never produces a blocker from otherRequirements', () => {
    const graph = buildQuestGraph([
      quest('a', {
        otherRequirements: ['The ability to defeat a level 195 Jungle Demon'],
      }),
    ]);

    expect(blockersFor(graph.byId.get('a')!, graph, {}, none)).toEqual([]);
    expect(statusFor(graph.byId.get('a')!, graph, {}, none).state).toBe('available');
  });

  // Boosts are shown, never assumed — we cannot know whether the member has
  // the potion, so a boostable requirement is still a requirement.
  it('still blocks on a boostable skill requirement', () => {
    const graph = buildQuestGraph([
      quest('a', { requirements: { skills: { mining: 10 } }, boostable: ['mining'] }),
    ]);

    expect(blockersFor(graph.byId.get('a')!, graph, { mining: 5 }, none)).toHaveLength(1);
  });
});

describe('solveQuests', () => {
  it('classifies every quest in one pass', () => {
    const graph = buildQuestGraph([
      quest('done'),
      quest('open'),
      quest('locked', { requirements: { skills: { mining: 50 } } }),
    ]);

    const states = Object.fromEntries(
      solveQuests(graph, {}, new Set(['done'])).map((s) => [s.quest.id, s.state]),
    );

    expect(states).toEqual({
      done: 'declared-complete',
      open: 'available',
      locked: 'blocked',
    });
  });

  it('lets a completed prerequisite unlock its dependant', () => {
    const graph = buildQuestGraph([
      quest('first'),
      quest('second', { requirements: { quests: ['first'] } }),
    ]);

    const before = solveQuests(graph, {}, none).find((s) => s.quest.id === 'second');
    const after = solveQuests(graph, {}, new Set(['first'])).find(
      (s) => s.quest.id === 'second',
    );

    expect(before?.state).toBe('blocked');
    expect(after?.state).toBe('available');
  });
});

describe('planFor', () => {
  it('returns the whole outstanding chain in doable order', () => {
    const graph = buildQuestGraph([
      quest('a'),
      quest('b', { requirements: { quests: ['a'] } }),
      quest('c', { requirements: { quests: ['b'] } }),
    ]);

    const plan = planFor(graph, 'c', {}, none);

    expect(plan?.questsToComplete.map((q) => q.id)).toEqual(['a', 'b']);
  });

  it('drops prerequisites already declared complete', () => {
    const graph = buildQuestGraph([
      quest('a'),
      quest('b', { requirements: { quests: ['a'] } }),
      quest('c', { requirements: { quests: ['b'] } }),
    ]);

    const plan = planFor(graph, 'c', {}, new Set(['a']));

    expect(plan?.questsToComplete.map((q) => q.id)).toEqual(['b']);
  });

  // Taking only the target's own requirements would tell a member they need
  // 50 Agility for Legends' Quest while omitting the 56 Agility that
  // Underground Pass demands on the way.
  it('unions skill requirements across the whole chain, keeping the highest', () => {
    const graph = buildQuestGraph([
      quest('a', { requirements: { skills: { agility: 56 } } }),
      quest('b', {
        requirements: { skills: { agility: 50, mining: 40 }, quests: ['a'] },
      }),
    ]);

    const plan = planFor(graph, 'b', {}, none);

    expect(plan?.skillsNeeded).toEqual({ agility: 56, mining: 40 });
  });

  it('omits skills the member already has', () => {
    const graph = buildQuestGraph([
      quest('a', { requirements: { skills: { agility: 20, mining: 40 } } }),
    ]);

    const plan = planFor(graph, 'a', { agility: 30 }, none);

    expect(plan?.skillsNeeded).toEqual({ mining: 40 });
  });

  it('counts the quest points the chain awards on the way', () => {
    const graph = buildQuestGraph([
      quest('a', { questPoints: 3 }),
      quest('b', { questPoints: 5, requirements: { quests: ['a'] } }),
      quest('c', { questPoints: 2, requirements: { quests: ['b'] } }),
    ]);

    const plan = planFor(graph, 'c', {}, none);

    expect(plan?.questPointsGained).toBe(8);
  });

  it('returns null for an unknown quest', () => {
    const graph = buildQuestGraph([quest('a')]);

    expect(planFor(graph, 'nope', {}, none)).toBeNull();
  });
});

describe('solveDiaryTier', () => {
  // Modelled on the real Ardougne Easy tier: one skill, a total level, no
  // quest requirement of its own.
  const easyTier: DiaryTier = {
    tier: 'Easy',
    requirements: { skills: { thieving: 5 }, totalLevel: 36, questPoints: 2 },
  };

  const diary: AchievementDiary = { id: 'test', name: 'Test', tiers: [easyTier] };

  it('reports a tier as achievable when every checkable requirement is met', () => {
    // A fresh account is 33 total; 5 Thieving brings it to 37, over the 36 gate.
    const status = solveDiaryTier(diary, easyTier, { thieving: 5 }, 2);

    expect(status.achievable).toBe(true);
    expect(status.blockers).toEqual([]);
  });

  it('blocks on a skill the tier needs', () => {
    const status = solveDiaryTier(diary, easyTier, {}, 2);

    expect(status.achievable).toBe(false);
    expect(status.blockers).toContainEqual({
      kind: 'skill',
      skill: 'thieving',
      required: 5,
      have: 1,
    });
  });

  it('blocks on total level, computed across all 24 skills', () => {
    const tier: DiaryTier = { tier: 'Elite', requirements: { totalLevel: 1500 } };

    expect(solveDiaryTier(diary, tier, { mining: 99 }, 0).blockers).toEqual([
      { kind: 'totalLevel', required: 1500, have: 33 + 98 },
    ]);
  });

  it('blocks on combat level, computed from the entered levels', () => {
    const tier: DiaryTier = { tier: 'Hard', requirements: { combatLevel: 85 } };

    const status = solveDiaryTier(diary, tier, { attack: 1 }, 0);

    expect(status.achievable).toBe(false);
    expect(status.blockers[0]).toMatchObject({ kind: 'combatLevel', required: 85 });
  });

  it('blocks on quest points', () => {
    const tier: DiaryTier = { tier: 'Medium', requirements: { questPoints: 20 } };

    expect(solveDiaryTier(diary, tier, {}, 5).blockers).toEqual([
      { kind: 'questPoints', required: 20, have: 5 },
    ]);
  });
});
