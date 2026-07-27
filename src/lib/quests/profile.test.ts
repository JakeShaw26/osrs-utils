import { describe, expect, it } from 'vitest';
import {
  emptyProfile,
  exportProfile,
  importProfile,
  loadProfile,
  PROFILE_STORAGE_KEY,
  saveProfile,
  type QuestProfile,
} from './profile';

/**
 * The browser-local profile.
 *
 * Export/import is the mitigation for the one genuinely bad consequence of
 * having no accounts (ADR-0012): clearing site data loses everything. So the
 * round trip is load-bearing, and the import path parses a file the member
 * could have hand-edited — which is why it is tested against junk rather than
 * only against its own output.
 */

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}

describe('exportProfile / importProfile', () => {
  it('round-trips levels and completions', () => {
    const profile: QuestProfile = {
      levels: { mining: 43, hitpoints: 50 },
      completed: ['cooks-assistant', 'demon-slayer'],
      rsn: 'Zezima',
    };

    const result = importProfile(exportProfile(profile));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile.levels).toEqual({ mining: 43, hitpoints: 50 });
    expect(result.profile.completed).toEqual(['cooks-assistant', 'demon-slayer']);
    expect(result.profile.rsn).toBe('Zezima');
    expect(result.dropped).toBe(0);
  });

  it('rejects text that is not JSON at all', () => {
    const result = importProfile('not json {');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/JSON/i);
  });

  it.each([['[]'], ['"a string"'], ['null'], ['42']])(
    'rejects %s, which is JSON but not a profile',
    (json) => {
      expect(importProfile(json).ok).toBe(false);
    },
  );

  it('refuses a file from a newer version rather than mangling it', () => {
    const result = importProfile(JSON.stringify({ version: 99, levels: {} }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/newer/i);
  });

  // Dropping the bad field rather than rejecting the file keeps the rest of a
  // member's data when one skill name changes or one entry is corrupt.
  it('drops unknown skills but keeps the valid ones, and counts what it dropped', () => {
    const result = importProfile(
      JSON.stringify({ levels: { mining: 43, sailing: 20, nonsense: 50 } }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile.levels).toEqual({ mining: 43, sailing: 20 });
    expect(result.dropped).toBe(1);
  });

  it.each([
    ['0', { mining: 0 }],
    ['100', { mining: 100 }],
    ['negative', { mining: -5 }],
    ['fractional', { mining: 12.5 }],
    ['a string', { mining: '43' }],
    ['below the Hitpoints floor', { hitpoints: 5 }],
  ])('drops an out-of-range level (%s)', (_label, levels) => {
    const result = importProfile(JSON.stringify({ levels }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile.levels).toEqual({});
    expect(result.dropped).toBe(1);
  });

  // The parser walks the skills we know about rather than copying whatever
  // keys the file carries, so a crafted key never becomes a property.
  it('ignores a __proto__ key in the levels object', () => {
    const result = importProfile(
      '{"levels":{"__proto__":{"polluted":true},"mining":43}}',
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile.levels).toEqual({ mining: 43 });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('drops non-string quest ids', () => {
    const result = importProfile(JSON.stringify({ completed: ['ok', 42, null, ''] }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile.completed).toEqual(['ok']);
    expect(result.dropped).toBe(3);
  });

  it('de-duplicates repeated completions', () => {
    const result = importProfile(JSON.stringify({ completed: ['a', 'a', 'b'] }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile.completed).toEqual(['a', 'b']);
  });

  it('accepts a file with no levels or completions', () => {
    const result = importProfile('{}');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile).toEqual({ levels: {}, completed: [], rsn: undefined });
  });
});

describe('loadProfile / saveProfile', () => {
  it('saves and reloads through storage', () => {
    const storage = fakeStorage();
    const profile: QuestProfile = { levels: { mining: 43 }, completed: ['a'] };

    expect(saveProfile(storage, profile)).toBe(true);
    expect(loadProfile(storage).levels).toEqual({ mining: 43 });
    expect(storage.map.has(PROFILE_STORAGE_KEY)).toBe(true);
  });

  it('returns an empty profile when nothing is stored', () => {
    expect(loadProfile(fakeStorage())).toEqual(emptyProfile());
  });

  it('returns an empty profile when storage holds corrupt data', () => {
    const storage = fakeStorage({ [PROFILE_STORAGE_KEY]: 'garbage' });

    expect(loadProfile(storage)).toEqual(emptyProfile());
  });

  // Storage can be unavailable for reasons unrelated to us — Safari private
  // mode, blocked cookies, a quota error. A planner that renders nothing in
  // that case is worse than one that starts empty.
  it('survives storage throwing on read', () => {
    const throwing = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {},
    };

    expect(loadProfile(throwing)).toEqual(emptyProfile());
  });

  it('reports failure rather than pretending, when a write throws', () => {
    const throwing = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };

    expect(saveProfile(throwing, emptyProfile())).toBe(false);
  });

  it('treats a missing storage (server render) as empty', () => {
    expect(loadProfile(undefined)).toEqual(emptyProfile());
    expect(saveProfile(undefined, emptyProfile())).toBe(false);
  });
});
