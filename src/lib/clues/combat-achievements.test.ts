import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `runBucketQuery` is stubbed rather than `fetch`, because what is worth
 * testing here is the mapping — the Bucket client's own escaping and
 * HTTP-200-with-an-error handling already have their own tests, and repeating
 * them would just make this file fail whenever that one changes.
 *
 * No test in this feature touches the network. CI runs without secrets, and a
 * test that needed the Wiki to be up would fail for reasons unrelated to the
 * code under test.
 */
const runBucketQuery = vi.fn();

vi.mock('@/lib/api/wiki-bucket', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/wiki-bucket')>()),
  runBucketQuery,
}));

const { fetchCombatAchievements } = await import('./combat-achievements');

beforeEach(() => {
  runBucketQuery.mockReset();
});

describe('fetchCombatAchievements', () => {
  it('unwraps repeated fields and returns usable tasks', () => {
    // Bucket fields are unpredictably `repeated` — `item_id` comes back as
    // ["1127"] while `combat_level` is a plain number, and which is which is
    // not guessable from the field's meaning.
    runBucketQuery.mockResolvedValue([
      {
        id: ['1'],
        name: ['Abyssal Adept'],
        monster: 'Abyssal Sire',
        task: ['Kill it.'],
        tier: 'Hard',
        type: 'Kill Count',
      },
    ]);

    return expect(fetchCombatAchievements()).resolves.toEqual([
      {
        id: 1,
        name: 'Abyssal Adept',
        monster: 'Abyssal Sire',
        task: 'Kill it.',
        tier: 'Hard',
        type: 'Kill Count',
      },
    ]);
  });

  it('sorts by game tier order, then by name', async () => {
    runBucketQuery.mockResolvedValue([
      { id: 3, name: 'Zeta', monster: 'A', task: 't', tier: 'Master', type: 'x' },
      { id: 1, name: 'Beta', monster: 'A', task: 't', tier: 'Easy', type: 'x' },
      { id: 2, name: 'Alpha', monster: 'A', task: 't', tier: 'Easy', type: 'x' },
    ]);

    const tasks = await fetchCombatAchievements();

    expect(tasks.map((t) => t.name)).toEqual(['Alpha', 'Beta', 'Zeta']);
  });

  it('sorts an unrecognised tier last rather than first', async () => {
    // A game update adding a tier we have not heard of should appear at the
    // bottom, not silently lead the whole list.
    runBucketQuery.mockResolvedValue([
      { id: 1, name: 'New', monster: 'A', task: 't', tier: 'Legendary', type: 'x' },
      { id: 2, name: 'Old', monster: 'A', task: 't', tier: 'Easy', type: 'x' },
    ]);

    const tasks = await fetchCombatAchievements();

    expect(tasks.map((t) => t.tier)).toEqual(['Easy', 'Legendary']);
  });

  it('drops rows that cannot be tracked or displayed', async () => {
    // Progress is keyed by id, so an id-less row can never be ticked; a
    // name-less row renders as a blank checkbox. Both are worse than absent.
    runBucketQuery.mockResolvedValue([
      { id: null, name: ['Nameable'], monster: 'A', task: 't', tier: 'Easy', type: 'x' },
      { id: 4, name: [''], monster: 'A', task: 't', tier: 'Easy', type: 'x' },
      { id: 5, name: ['Fine'], monster: 'A', task: 't', tier: 'Easy', type: 'x' },
    ]);

    const tasks = await fetchCombatAchievements();

    expect(tasks.map((t) => t.id)).toEqual([5]);
  });

  it('returns an empty catalogue when the bucket has no rows', async () => {
    runBucketQuery.mockResolvedValue([]);

    await expect(fetchCombatAchievements()).resolves.toEqual([]);
  });

  it('queries the verified bucket and field names', async () => {
    // Bucket field names are not guessable and an unknown one is a hard error
    // upstream, so pinning the introspected names is worth a test.
    runBucketQuery.mockResolvedValue([]);

    await fetchCombatAchievements();

    expect(runBucketQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: 'combat_achievement',
        select: ['id', 'name', 'monster', 'task', 'tier', 'type'],
      }),
    );
  });
});
