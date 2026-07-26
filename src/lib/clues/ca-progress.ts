/**
 * Self-declared Combat Achievement progress — serialisation only.
 *
 * ## Why this is browser-local and can never be anything else
 *
 * There is no sign-in, so every request is anonymous and untrusted, and there
 * is no public write path (ADR-0012, hard rule #5). Personal progress therefore
 * lives in the member's own browser and never reaches our database. That is not
 * a limitation we are working around; it is the security model.
 *
 * Two consequences the UI is required to state rather than imply:
 *
 *  - **It is self-reported, so it is not evidence.** Nothing checks it against
 *    the game, because nothing can. It must never feed a ranked or competitive
 *    view — a leaderboard over numbers members type in themselves is won by
 *    whoever types the biggest one (PRD §3.4, §3.8).
 *  - **It is disposable.** Clearing site data or switching device loses it.
 *    Export/import below is the mitigation, and it is the reason this file
 *    exists as testable logic rather than a `useState` in a component.
 *
 * No DOM here on purpose: `localStorage` is passed in, so every branch —
 * including the corrupt-data ones, which are the branches that matter — is
 * testable under node.
 */

export const CA_PROGRESS_STORAGE_KEY = 'osrs-toolkit:ca-progress:v1';

/**
 * Bumped only on a breaking shape change. An export from a future version is
 * rejected rather than half-read: silently dropping fields we do not understand
 * would lose a member's data without telling them.
 */
export const CA_PROGRESS_VERSION = 1;

export interface CaProgressFile {
  version: number;
  /** Wiki `combat_achievement.id` values the member says they have done. */
  completedIds: number[];
  /** ISO timestamp, informational — shown so a stale export is recognisable. */
  exportedAt: string;
}

/** A `Storage`-shaped object. Narrowed so tests can pass a plain fake. */
export interface ProgressStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function sanitiseIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];

  const ids = value.filter(
    (id): id is number => typeof id === 'number' && Number.isInteger(id) && id >= 0,
  );

  // Deduplicated and sorted so two exports of the same progress are byte
  // identical — which makes "did my import work?" answerable by eye.
  return [...new Set(ids)].sort((a, b) => a - b);
}

/**
 * Reads stored progress, treating anything unreadable as "no progress".
 *
 * Deliberately total: this runs on mount, and throwing here would blank the
 * page over a stray character in a value the member cannot see or edit. A
 * silent reset is bad, but a tracker that will not render at all is worse — and
 * the export file is the real backup.
 */
export function loadProgress(storage: ProgressStorage): Set<number> {
  let raw: string | null;
  try {
    raw = storage.getItem(CA_PROGRESS_STORAGE_KEY);
  } catch {
    // Safari in private mode, and any browser with storage blocked.
    return new Set();
  }
  if (!raw) return new Set();

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return new Set();
    return new Set(sanitiseIds((parsed as { completedIds?: unknown }).completedIds));
  } catch {
    return new Set();
  }
}

/** Writes progress. Returns false when storage refused, so the UI can say so. */
export function saveProgress(storage: ProgressStorage, ids: Iterable<number>): boolean {
  try {
    storage.setItem(CA_PROGRESS_STORAGE_KEY, JSON.stringify({ completedIds: [...ids] }));
    return true;
  } catch {
    return false;
  }
}

/** The export file's contents. Pretty-printed — members will open it. */
export function exportProgress(ids: Iterable<number>, now: Date = new Date()): string {
  const file: CaProgressFile = {
    version: CA_PROGRESS_VERSION,
    completedIds: sanitiseIds([...ids]),
    exportedAt: now.toISOString(),
  };
  return JSON.stringify(file, null, 2);
}

export type ImportResult = { ok: true; ids: Set<number> } | { ok: false; error: string };

/**
 * Parses an export file.
 *
 * Unlike `loadProgress` this reports failure rather than swallowing it: the
 * member is actively pasting something and needs to know it did not take. An
 * import that silently produced an empty tracker would look like it had wiped
 * their progress.
 */
export function importProgress(json: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: 'That is not valid JSON.' };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'Expected an exported progress file.' };
  }

  const file = parsed as Partial<CaProgressFile>;

  if (typeof file.version !== 'number') {
    return { ok: false, error: 'Missing a version — is this a progress export?' };
  }
  if (file.version > CA_PROGRESS_VERSION) {
    return {
      ok: false,
      error: `This file is from a newer version (${file.version}). Update the page and try again.`,
    };
  }
  if (!Array.isArray(file.completedIds)) {
    return { ok: false, error: 'Missing the completedIds list.' };
  }

  return { ok: true, ids: new Set(sanitiseIds(file.completedIds)) };
}
