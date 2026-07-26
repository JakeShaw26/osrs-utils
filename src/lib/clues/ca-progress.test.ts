import { describe, expect, it } from 'vitest';
import {
  CA_PROGRESS_STORAGE_KEY,
  CA_PROGRESS_VERSION,
  exportProgress,
  importProgress,
  loadProgress,
  saveProgress,
  type ProgressStorage,
} from './ca-progress';

/**
 * A `Storage` stand-in. The real one does not exist under node, and injecting a
 * fake is what lets the failure branches — corrupt JSON, a browser refusing to
 * write — be tested at all. Those branches are the whole reason this module is
 * separate from the component.
 */
function fakeStorage(initial: Record<string, string> = {}): ProgressStorage & {
  data: Record<string, string>;
} {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

function throwingStorage(): ProgressStorage {
  return {
    getItem() {
      throw new Error('storage disabled');
    },
    setItem() {
      throw new Error('storage disabled');
    },
  };
}

describe('loadProgress / saveProgress', () => {
  it('round-trips ticked task ids', () => {
    const storage = fakeStorage();

    expect(saveProgress(storage, [5, 1, 5])).toBe(true);
    expect([...loadProgress(storage)].sort((a, b) => a - b)).toEqual([1, 5]);
  });

  it('returns nothing when there is no stored progress', () => {
    expect(loadProgress(fakeStorage()).size).toBe(0);
  });

  it('treats corrupt storage as empty rather than throwing', () => {
    // This runs on mount. Throwing would blank the whole page over a value the
    // member cannot see, let alone fix.
    expect(
      loadProgress(fakeStorage({ [CA_PROGRESS_STORAGE_KEY]: 'not json' })).size,
    ).toBe(0);
    expect(loadProgress(fakeStorage({ [CA_PROGRESS_STORAGE_KEY]: '[1,2,3]' })).size).toBe(
      0,
    );
    expect(
      loadProgress(fakeStorage({ [CA_PROGRESS_STORAGE_KEY]: '{"completedIds":"nope"}' }))
        .size,
    ).toBe(0);
  });

  it('drops entries that are not usable task ids', () => {
    const storage = fakeStorage({
      [CA_PROGRESS_STORAGE_KEY]: '{"completedIds":[1,"2",null,-3,4.5,7]}',
    });

    expect([...loadProgress(storage)].sort((a, b) => a - b)).toEqual([1, 7]);
  });

  it('survives a browser that refuses storage entirely', () => {
    // Private-mode Safari and locked-down enterprise browsers both do this.
    expect(loadProgress(throwingStorage()).size).toBe(0);
    expect(saveProgress(throwingStorage(), [1])).toBe(false);
  });
});

describe('exportProgress', () => {
  it('writes a versioned, timestamped file', () => {
    const json = exportProgress([3, 1], new Date('2026-07-26T10:00:00Z'));
    const parsed = JSON.parse(json);

    expect(parsed.version).toBe(CA_PROGRESS_VERSION);
    expect(parsed.completedIds).toEqual([1, 3]);
    expect(parsed.exportedAt).toBe('2026-07-26T10:00:00.000Z');
  });

  it('produces identical output for the same progress in any order', () => {
    // Sorted and deduplicated so a member can eyeball two exports and tell
    // whether anything actually changed.
    const now = new Date('2026-07-26T10:00:00Z');

    expect(exportProgress([3, 1, 3], now)).toBe(exportProgress([1, 3], now));
  });
});

describe('importProgress', () => {
  it('round-trips an export', () => {
    const result = importProgress(exportProgress([2, 9]));

    expect(result.ok).toBe(true);
    if (result.ok) expect([...result.ids].sort((a, b) => a - b)).toEqual([2, 9]);
  });

  it('reports invalid JSON rather than silently wiping progress', () => {
    // Unlike loading, importing is an explicit action — silence here would look
    // exactly like "my progress got deleted".
    const result = importProgress('{ oops');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/valid JSON/i);
  });

  it('rejects a file with no version', () => {
    const result = importProgress('{"completedIds":[1]}');

    expect(result.ok).toBe(false);
  });

  it('rejects a file from a newer version instead of half-reading it', () => {
    const result = importProgress(
      JSON.stringify({ version: CA_PROGRESS_VERSION + 1, completedIds: [1] }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/newer version/i);
  });

  it('rejects a file with no completedIds list', () => {
    const result = importProgress(JSON.stringify({ version: CA_PROGRESS_VERSION }));

    expect(result.ok).toBe(false);
  });

  it('rejects a bare array or a JSON scalar', () => {
    expect(importProgress('[1,2,3]').ok).toBe(false);
    expect(importProgress('42').ok).toBe(false);
    expect(importProgress('null').ok).toBe(false);
  });

  it('sanitises hostile-looking ids out of an imported file', () => {
    // The file is untrusted input a member pasted from anywhere. It never
    // reaches the server, but it must not be able to put junk in the UI either.
    const result = importProgress(
      JSON.stringify({
        version: CA_PROGRESS_VERSION,
        completedIds: [1, '2', { id: 3 }, Number.NaN, -1],
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect([...result.ids]).toEqual([1]);
  });
});
