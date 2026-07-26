import type { Quest } from './types';

/**
 * The quest prerequisite DAG.
 *
 * Quests form a directed acyclic graph: Legends' Quest needs Heroes' Quest,
 * which needs Dragon Slayer I, which needs 32 quest points. The dataset stores
 * only *direct* edges; everything transitive is derived here so that adding a
 * quest means adding one line rather than restating its ancestors.
 *
 * WHY CYCLE DETECTION IS NOT PARANOIA
 *
 * The data is authored by hand. A typo that makes A require B while B requires
 * A is a plausible mistake, and every interesting operation on this graph is a
 * recursive walk — so an undetected cycle is not a wrong answer, it is an
 * infinite loop that hangs the browser tab with no error to read. Detecting it
 * turns a silent hang into a loud, locatable failure. `quest-data.test.ts`
 * runs this against the real dataset.
 */

export class QuestGraphError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuestGraphError';
  }
}

export interface QuestGraph {
  readonly quests: readonly Quest[];
  readonly byId: ReadonlyMap<string, Quest>;
  /** Direct prerequisites, as ids. */
  prerequisitesOf(id: string): readonly string[];
}

/**
 * Indexes quests by id and validates the graph.
 *
 * Throws on a duplicate id, a prerequisite that does not exist, or a cycle.
 * Failing at construction rather than at query time means a bad dataset cannot
 * reach a page: the import throws, the tests go red, and the error names the
 * offending quest instead of surfacing later as a mysterious empty result.
 */
export function buildQuestGraph(quests: readonly Quest[]): QuestGraph {
  const byId = new Map<string, Quest>();

  for (const quest of quests) {
    if (byId.has(quest.id)) {
      throw new QuestGraphError(`Duplicate quest id "${quest.id}".`);
    }
    byId.set(quest.id, quest);
  }

  for (const quest of quests) {
    for (const id of quest.requirements.quests ?? []) {
      if (!byId.has(id)) {
        throw new QuestGraphError(
          `"${quest.name}" requires unknown quest "${id}". ` +
            `Add it to QUESTS, or remove the prerequisite.`,
        );
      }
    }
  }

  assertAcyclic(quests, byId);

  return {
    quests,
    byId,
    prerequisitesOf: (id) => byId.get(id)?.requirements.quests ?? [],
  };
}

/**
 * Iterative depth-first search with an explicit colour marking.
 *
 * Iterative rather than recursive because the recursion depth is bounded by
 * the data, not by us — and a stack overflow reports the wrong problem.
 */
function assertAcyclic(quests: readonly Quest[], byId: ReadonlyMap<string, Quest>): void {
  const UNVISITED = 0;
  const IN_PROGRESS = 1;
  const DONE = 2;
  const colour = new Map<string, number>();
  for (const quest of quests) colour.set(quest.id, UNVISITED);

  for (const root of quests) {
    if (colour.get(root.id) !== UNVISITED) continue;

    // Each frame keeps its own cursor so the path can be reconstructed.
    const stack: { id: string; next: number }[] = [{ id: root.id, next: 0 }];
    colour.set(root.id, IN_PROGRESS);

    while (stack.length > 0) {
      const frame = stack.at(-1);
      if (!frame) break;

      const prerequisites = byId.get(frame.id)?.requirements.quests ?? [];
      const nextId = prerequisites[frame.next];

      if (nextId === undefined) {
        colour.set(frame.id, DONE);
        stack.pop();
        continue;
      }

      frame.next += 1;

      if (colour.get(nextId) === DONE) continue;

      if (colour.get(nextId) === IN_PROGRESS) {
        const from = stack.findIndex((f) => f.id === nextId);
        const cycle = [...stack.slice(from).map((f) => f.id), nextId];
        throw new QuestGraphError(
          `Prerequisite cycle: ${cycle.join(' -> ')}. ` +
            `A quest cannot require itself, directly or indirectly.`,
        );
      }

      colour.set(nextId, IN_PROGRESS);
      stack.push({ id: nextId, next: 0 });
    }
  }
}

/**
 * Every quest that must be completed before `id`, transitively.
 *
 * Returned in an order where a quest always follows its own prerequisites, so
 * the caller can render it directly as a to-do list. `id` itself is excluded.
 */
export function resolvePrerequisites(graph: QuestGraph, id: string): readonly string[] {
  const seen = new Set<string>();
  const order: string[] = [];

  const visit = (current: string): void => {
    if (seen.has(current)) return;
    seen.add(current);
    for (const prerequisite of graph.prerequisitesOf(current)) {
      visit(prerequisite);
      // Recursion is safe here only because buildQuestGraph proved acyclic.
    }
    order.push(current);
  };

  for (const prerequisite of graph.prerequisitesOf(id)) visit(prerequisite);

  return order;
}
