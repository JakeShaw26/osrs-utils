import { buildQuestGraph } from './graph';
import { QUESTS } from './quest-data';

export * from './types';
export * from './graph';
export * from './levels';
export * from './solver';
export * from './profile';
export { QUESTS, QUEST_COVERAGE } from './quest-data';
export { DIARIES } from './diary-data';

/**
 * The validated graph over the authored dataset.
 *
 * Built once at module load. That is deliberate — it is pure computation over
 * a literal, with no environment access and no client construction, so it does
 * not fall foul of hard rule #2. Validating here means a dataset with a
 * duplicate id, a dangling prerequisite or a cycle fails the build and the
 * tests rather than reaching a page and hanging it.
 */
export const QUEST_GRAPH = buildQuestGraph(QUESTS);
