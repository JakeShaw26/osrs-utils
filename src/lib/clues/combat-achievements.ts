import 'server-only';
import {
  BUCKETS,
  firstNumber,
  firstValue,
  runBucketQuery,
  type Repeatable,
} from '@/lib/api/wiki-bucket';
import { CA_TIER_ORDER, type CombatAchievement } from './ca-types';

export type { CombatAchievement };
export { CA_TIER_ORDER };

/**
 * The Combat Achievement **catalogue**, from the OSRS Wiki Bucket API.
 *
 * ## Why this exists at all
 *
 * CAs are verified absent from the hiscores, and no public API exposes a
 * player's completions (PRD §3.4). The recorded conclusion was "author the task
 * list by hand or drop the feature". That turns out to be wrong: probing the
 * Bucket namespace on 2026-07-26 found **`Bucket:Combat achievement`**, a fully
 * structured catalogue — 646 rows of `id`, `name`, `monster`, `task`, `tier`,
 * `type`. So the *task list* is a one-request fetch, not a content project.
 *
 * **What is still impossible is completion.** Nothing here knows or can know
 * which tasks a member has done; that stays self-declared and browser-local
 * (`ca-progress.ts`, ADR-0012). This module supplies the questions, never the
 * answers.
 *
 */

const COMBAT_ACHIEVEMENT_BUCKET = BUCKETS.combatAchievement;

/** Verified schema, 2026-07-26. Field names are not guessable — introspect. */
const CA_FIELDS = ['id', 'name', 'monster', 'task', 'tier', 'type'] as const;

interface CombatAchievementRow {
  id: Repeatable<string | number>;
  name: Repeatable<string>;
  monster: Repeatable<string>;
  task: Repeatable<string>;
  tier: Repeatable<string>;
  type: Repeatable<string>;
}

function tierRank(tier: string): number {
  const index = (CA_TIER_ORDER as readonly string[]).indexOf(tier);
  // Unknown tiers sort last rather than first: a new tier we have not heard of
  // should appear at the bottom, not silently lead the list.
  return index === -1 ? CA_TIER_ORDER.length : index;
}

/**
 * The whole catalogue, one request, cached for a day by the `wiki` source
 * default. 646 rows is ~100 KB — small enough to fetch whole and far politer
 * than paging, which is what the wiki's own guidance asks for.
 *
 * `limit` is generous rather than exact so a game update adding tasks does not
 * silently truncate the list.
 */
export async function fetchCombatAchievements(): Promise<CombatAchievement[]> {
  const rows = await runBucketQuery<CombatAchievementRow>({
    bucket: COMBAT_ACHIEVEMENT_BUCKET,
    select: CA_FIELDS,
    limit: 5000,
  });

  return (
    rows
      .map((row) => ({
        id: firstNumber(row.id) ?? -1,
        name: firstValue(row.name) ?? '',
        monster: firstValue(row.monster) ?? '',
        task: firstValue(row.task) ?? '',
        tier: firstValue(row.tier) ?? '',
        type: firstValue(row.type) ?? '',
      }))
      // A row with no id cannot be tracked — progress is keyed by id — and a row
      // with no name cannot be displayed. Dropping them beats rendering blanks.
      .filter((task) => task.id >= 0 && task.name !== '')
      .sort((a, b) => tierRank(a.tier) - tierRank(b.tier) || a.name.localeCompare(b.name))
  );
}
