import { MAX_LEVEL, isSkillName, type PlayerLevels } from './types';
import { minimumFor } from './levels';

/**
 * The member's browser-local profile: their levels, and what they say they
 * have completed.
 *
 * WHY THIS IS NOT IN THE DATABASE
 *
 * There is no sign-in (ADR-0012), so there is no user to key a row to and no
 * way to authorise a write. Personal data belongs in the member's browser, and
 * a public write path would be a defect rather than a feature (hard rule #5).
 *
 * The cost is that clearing site data loses it, which is exactly why
 * `exportProfile`/`importProfile` exist and why the UI puts them in front of
 * the member rather than hiding them in a menu.
 *
 * Everything here is pure and takes storage as an argument. That keeps the
 * parsing — the part with the edge cases — testable without a DOM, and it is
 * the reason `importProfile` can be tested against hostile input directly.
 */

export const PROFILE_STORAGE_KEY = 'osrs-toolkit:quests:v1';

/** Bumped only if the shape changes incompatibly; `importProfile` checks it. */
const PROFILE_VERSION = 1;

export interface QuestProfile {
  readonly levels: PlayerLevels;
  /** Quest ids the member declares complete. Unverifiable — see types.ts. */
  readonly completed: readonly string[];
  /** Remembered so the hiscores prefill does not need retyping. Not a login. */
  readonly rsn?: string;
}

export function emptyProfile(): QuestProfile {
  return { levels: {}, completed: [] };
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Validates untrusted JSON into a profile.
 *
 * Unknown skills, out-of-range levels and non-string quest ids are **dropped
 * rather than rejected**: an import that fails wholesale because one skill was
 * renamed loses the member everything, whereas dropping the bad field keeps
 * the rest. The count of dropped fields is returned so the UI can say so
 * instead of silently discarding data.
 *
 * Note this validates by allowlist — it walks the skills we know about rather
 * than copying whatever keys the input happens to carry. A parser that spread
 * the incoming object would happily accept `__proto__` and anything else.
 */
export function importProfile(
  json: string,
): { ok: true; profile: QuestProfile; dropped: number } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: 'That is not valid JSON. Paste the whole exported file.' };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'Expected an exported profile object.' };
  }

  const record = parsed as Record<string, unknown>;

  if (typeof record.version === 'number' && record.version > PROFILE_VERSION) {
    return {
      ok: false,
      error: `This file was exported by a newer version (v${record.version}).`,
    };
  }

  let dropped = 0;

  const levels: Record<string, number> = {};
  const rawLevels = record.levels;
  if (typeof rawLevels === 'object' && rawLevels !== null && !Array.isArray(rawLevels)) {
    for (const [key, value] of Object.entries(rawLevels as Record<string, unknown>)) {
      if (!isSkillName(key) || typeof value !== 'number' || !Number.isInteger(value)) {
        dropped += 1;
        continue;
      }
      if (value < minimumFor(key) || value > MAX_LEVEL) {
        dropped += 1;
        continue;
      }
      levels[key] = value;
    }
  } else if (rawLevels !== undefined) {
    dropped += 1;
  }

  const completed: string[] = [];
  const rawCompleted = record.completed;
  if (Array.isArray(rawCompleted)) {
    for (const id of rawCompleted) {
      if (typeof id === 'string' && id !== '') completed.push(id);
      else dropped += 1;
    }
  } else if (rawCompleted !== undefined) {
    dropped += 1;
  }

  const rsn =
    typeof record.rsn === 'string' && record.rsn.trim() !== ''
      ? record.rsn.trim().slice(0, 12)
      : undefined;

  return {
    ok: true,
    profile: { levels: levels as PlayerLevels, completed: [...new Set(completed)], rsn },
    dropped,
  };
}

/** Pretty-printed so a member can read and hand-edit the file they saved. */
export function exportProfile(profile: QuestProfile): string {
  return JSON.stringify(
    {
      version: PROFILE_VERSION,
      exportedAt: new Date().toISOString(),
      levels: profile.levels,
      completed: [...profile.completed].sort(),
      ...(profile.rsn ? { rsn: profile.rsn } : {}),
    },
    null,
    2,
  );
}

/**
 * Reads the stored profile, falling back to an empty one.
 *
 * Never throws. Storage can fail for reasons that have nothing to do with us —
 * Safari private mode, a disabled-cookies setting, a quota error — and a quest
 * planner that renders nothing because localStorage was unavailable is a worse
 * outcome than one that starts empty.
 */
export function loadProfile(storage: StorageLike | undefined): QuestProfile {
  if (!storage) return emptyProfile();

  let raw: string | null;
  try {
    raw = storage.getItem(PROFILE_STORAGE_KEY);
  } catch {
    return emptyProfile();
  }
  if (raw === null) return emptyProfile();

  const result = importProfile(raw);
  return result.ok ? result.profile : emptyProfile();
}

/** Returns false when the write failed, so the UI can warn rather than lie. */
export function saveProfile(
  storage: StorageLike | undefined,
  profile: QuestProfile,
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(PROFILE_STORAGE_KEY, exportProfile(profile));
    return true;
  } catch {
    return false;
  }
}
