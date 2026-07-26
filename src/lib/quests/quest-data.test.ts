import { describe, expect, it } from 'vitest';
import { buildQuestGraph, resolvePrerequisites } from './graph';
import { QUESTS, QUEST_COVERAGE } from './quest-data';
import { DIARIES } from './diary-data';
import { DIARY_TIERS, isSkillName, MAX_LEVEL, MIN_LEVEL } from './types';

/**
 * Integrity of the authored datasets.
 *
 * This is the test that matters most in the whole feature. The graph is
 * hand-authored from wiki prose, so the realistic failure is not a bug in the
 * solver — it is a typo in the data that makes "what can I do now" quietly
 * wrong, which is worse than giving no answer at all. Everything below is a
 * property that must hold for any future edit, not a snapshot of today's
 * dataset.
 */

describe('QUESTS dataset', () => {
  it('builds a valid graph — no duplicates, no dangling ids, no cycles', () => {
    expect(() => buildQuestGraph(QUESTS)).not.toThrow();
  });

  it('matches the coverage figure shown in the UI', () => {
    expect(QUESTS).toHaveLength(QUEST_COVERAGE.modelled);
    expect(QUEST_COVERAGE.modelled).toBeLessThanOrEqual(QUEST_COVERAGE.inGame);
  });

  // Restated independently of buildQuestGraph so a regression in the graph's
  // own validation cannot hide a data problem.
  it('has a unique id for every quest', () => {
    const ids = QUESTS.map((q) => q.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('references only prerequisites that exist in the dataset', () => {
    const ids = new Set(QUESTS.map((q) => q.id));

    const dangling = QUESTS.flatMap((q) =>
      (q.requirements.quests ?? [])
        .filter((id) => !ids.has(id))
        .map((id) => `${q.name} -> ${id}`),
    );

    expect(dangling).toEqual([]);
  });

  it('never lists a quest as its own prerequisite', () => {
    const selfReferential = QUESTS.filter((q) =>
      (q.requirements.quests ?? []).includes(q.id),
    );

    expect(selfReferential).toEqual([]);
  });

  it('lists no prerequisite twice', () => {
    const duplicated = QUESTS.filter((q) => {
      const list = q.requirements.quests ?? [];
      return new Set(list).size !== list.length;
    });

    expect(duplicated.map((q) => q.name)).toEqual([]);
  });

  // The wiki spells out transitive prerequisites for the reader; storing them
  // would be duplication that drifts out of step with the direct edges.
  it('stores only direct edges — no prerequisite is also a transitive one', () => {
    const graph = buildQuestGraph(QUESTS);

    const redundant = QUESTS.flatMap((quest) => {
      const direct = quest.requirements.quests ?? [];
      return direct
        .filter((id) =>
          direct.some(
            (other) => other !== id && resolvePrerequisites(graph, other).includes(id),
          ),
        )
        .map((id) => `${quest.name} -> ${id}`);
    });

    expect(redundant).toEqual([]);
  });

  it('uses only known skill names, at plausible levels', () => {
    const bad = QUESTS.flatMap((q) =>
      Object.entries(q.requirements.skills ?? {})
        .filter(
          ([skill, level]) =>
            !isSkillName(skill) || level < MIN_LEVEL || level > MAX_LEVEL,
        )
        .map(([skill, level]) => `${q.name}: ${skill} ${level}`),
    );

    expect(bad).toEqual([]);
  });

  it('only marks a skill boostable if that skill is actually required', () => {
    const orphaned = QUESTS.flatMap((q) =>
      (q.boostable ?? [])
        .filter((skill) => q.requirements.skills?.[skill] === undefined)
        .map((skill) => `${q.name}: ${skill}`),
    );

    expect(orphaned).toEqual([]);
  });

  it('awards a sane number of quest points', () => {
    for (const quest of QUESTS) {
      expect(quest.questPoints).toBeGreaterThanOrEqual(0);
      expect(quest.questPoints).toBeLessThanOrEqual(10);
    }
  });

  it('awards no quest points for a miniquest', () => {
    for (const quest of QUESTS.filter((q) => q.miniquest)) {
      expect(quest.questPoints).toBe(0);
    }
  });

  // Sourced from the wiki: free-to-play quests award 46 QP in total, of which
  // one comes from Tutorial Island, which is not a quest anyone plans around.
  it('covers every free-to-play quest, totalling 45 quest points', () => {
    const free = QUESTS.filter((q) => !q.members);

    expect(free).toHaveLength(23);
    expect(free.reduce((sum, q) => sum + q.questPoints, 0)).toBe(45);
  });

  // A quest-point gate can only be met by quests worth fewer points than the
  // gate itself; a requirement above the total available would be unreachable.
  it('never requires more quest points than the dataset can award', () => {
    const available = QUESTS.reduce((sum, q) => sum + q.questPoints, 0);

    for (const quest of QUESTS) {
      expect(quest.requirements.questPoints ?? 0).toBeLessThanOrEqual(available);
    }
  });

  it('never lets a free-to-play quest depend on a members quest', () => {
    const byId = new Map(QUESTS.map((q) => [q.id, q]));

    const bad = QUESTS.filter((q) => !q.members).flatMap((q) =>
      (q.requirements.quests ?? [])
        .filter((id) => byId.get(id)?.members)
        .map((id) => `${q.name} -> ${id}`),
    );

    expect(bad).toEqual([]);
  });
});

describe('DIARIES dataset', () => {
  it('has twelve diaries with four tiers each, in order', () => {
    expect(DIARIES).toHaveLength(12);

    for (const diary of DIARIES) {
      expect(diary.tiers.map((t) => t.tier)).toEqual(DIARY_TIERS);
    }
  });

  it('has a unique id for every diary', () => {
    const ids = DIARIES.map((d) => d.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses only known skill names, at plausible levels', () => {
    const bad = DIARIES.flatMap((d) =>
      d.tiers.flatMap((t) =>
        Object.entries(t.requirements.skills ?? {})
          .filter(
            ([skill, level]) =>
              !isSkillName(skill) || level < MIN_LEVEL || level > MAX_LEVEL,
          )
          .map(([skill, level]) => `${d.name} ${t.tier}: ${skill} ${level}`),
      ),
    );

    expect(bad).toEqual([]);
  });

  // Elite tasks are never easier than the Easy ones. A tier whose total-level
  // requirement went backwards would mean a row was misread during extraction.
  it('has total-level requirements that increase with tier', () => {
    for (const diary of DIARIES) {
      const totals = diary.tiers.map((t) => t.requirements.totalLevel ?? 0);

      expect(totals).toEqual([...totals].sort((a, b) => a - b));
    }
  });

  it('never requires a total level above the maximum possible', () => {
    const maximum = 24 * MAX_LEVEL;

    for (const diary of DIARIES) {
      for (const tier of diary.tiers) {
        expect(tier.requirements.totalLevel ?? 0).toBeLessThanOrEqual(maximum);
      }
    }
  });
});
