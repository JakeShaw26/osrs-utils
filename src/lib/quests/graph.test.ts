import { describe, expect, it } from 'vitest';
import { buildQuestGraph, QuestGraphError, resolvePrerequisites } from './graph';
import type { Quest } from './types';

/**
 * Graph construction and the cycle guard.
 *
 * The cycle test is the important one here. Every operation on this graph is a
 * recursive walk, so a cycle introduced by a data typo would not produce a
 * wrong answer — it would hang the page with no error to read. These tests
 * pin that a bad dataset fails loudly, at construction, naming the quests
 * involved.
 */

function quest(
  id: string,
  requires: string[] = [],
  overrides: Partial<Quest> = {},
): Quest {
  return {
    id,
    name: id,
    members: false,
    questPoints: 1,
    difficulty: 'Novice',
    length: 'Short',
    requirements: requires.length ? { quests: requires } : {},
    ...overrides,
  };
}

describe('buildQuestGraph', () => {
  it('indexes quests by id', () => {
    const graph = buildQuestGraph([quest('a'), quest('b')]);

    expect(graph.byId.get('a')?.name).toBe('a');
    expect(graph.quests).toHaveLength(2);
  });

  it('rejects a duplicate id', () => {
    expect(() => buildQuestGraph([quest('a'), quest('a')])).toThrow(QuestGraphError);
  });

  // A prerequisite naming a quest that was never added is the likeliest data
  // error, and the failure it causes without this check is a quest that is
  // permanently blocked by something the UI cannot name.
  it('rejects a prerequisite that does not exist', () => {
    expect(() => buildQuestGraph([quest('a', ['ghost'])])).toThrow(
      /unknown quest "ghost"/,
    );
  });

  it('detects a direct cycle and names both quests', () => {
    const build = () => buildQuestGraph([quest('a', ['b']), quest('b', ['a'])]);

    expect(build).toThrow(QuestGraphError);
    expect(build).toThrow(/cycle/i);
  });

  it('detects an indirect cycle across three quests', () => {
    const build = () =>
      buildQuestGraph([quest('a', ['b']), quest('b', ['c']), quest('c', ['a'])]);

    expect(build).toThrow(/a -> b -> c -> a/);
  });

  it('detects a quest that requires itself', () => {
    expect(() => buildQuestGraph([quest('a', ['a'])])).toThrow(/cycle/i);
  });

  // A diamond (two paths converging on one ancestor) is not a cycle, and a
  // naive "have I seen this node" check would wrongly reject it.
  it('accepts a diamond dependency', () => {
    const build = () =>
      buildQuestGraph([
        quest('root'),
        quest('left', ['root']),
        quest('right', ['root']),
        quest('top', ['left', 'right']),
      ]);

    expect(build).not.toThrow();
  });
});

describe('resolvePrerequisites', () => {
  // The headline case: C needs B needs A, so asking for C must surface A even
  // though C never mentions it.
  it('resolves transitive prerequisites', () => {
    const graph = buildQuestGraph([quest('a'), quest('b', ['a']), quest('c', ['b'])]);

    expect(resolvePrerequisites(graph, 'c')).toEqual(['a', 'b']);
  });

  it('orders each quest after its own prerequisites', () => {
    const graph = buildQuestGraph([
      quest('root'),
      quest('left', ['root']),
      quest('right', ['left']),
      quest('top', ['right', 'left']),
    ]);

    const order = resolvePrerequisites(graph, 'top');

    expect(order.indexOf('root')).toBeLessThan(order.indexOf('left'));
    expect(order.indexOf('left')).toBeLessThan(order.indexOf('right'));
  });

  it('lists a shared ancestor once', () => {
    const graph = buildQuestGraph([
      quest('root'),
      quest('left', ['root']),
      quest('right', ['root']),
      quest('top', ['left', 'right']),
    ]);

    expect(resolvePrerequisites(graph, 'top')).toHaveLength(3);
  });

  it('excludes the target itself', () => {
    const graph = buildQuestGraph([quest('a'), quest('b', ['a'])]);

    expect(resolvePrerequisites(graph, 'b')).not.toContain('b');
  });

  it('returns nothing for a quest with no prerequisites', () => {
    const graph = buildQuestGraph([quest('a')]);

    expect(resolvePrerequisites(graph, 'a')).toEqual([]);
  });
});
