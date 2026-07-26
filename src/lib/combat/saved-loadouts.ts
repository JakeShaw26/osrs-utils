import type { LoadoutDraft } from './draft';

/**
 * Saved loadouts, stored in the visitor's own browser.
 *
 * There is no sign-in, so there is no account to hang a saved loadout on and no
 * trusted write path that could accept one — personal state belongs in the
 * member's browser (ADR-0012, hard rules 5 and 6).
 *
 * Exposed as a `useSyncExternalStore`-shaped store rather than as
 * `useState` + `useEffect`. Reading `localStorage` in an effect and calling
 * `setState` is a cascading render React now warns about, and the store shape
 * gets multi-tab synchronisation for free: save a loadout in one tab and the
 * comparison table in another updates.
 */

const STORAGE_KEY = 'osrs-toolkit:combat:loadouts';

/**
 * A stable empty array. `getSnapshot` must return a referentially equal value
 * when nothing changed, or React re-renders forever.
 */
const EMPTY: readonly LoadoutDraft[] = [];

const listeners = new Set<() => void>();

let cachedRaw: string | null = null;
let cachedValue: readonly LoadoutDraft[] = EMPTY;

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeToSavedLoadouts(listener: () => void): () => void {
  listeners.add(listener);
  // Fires only for *other* tabs, which is exactly the case our own writes miss.
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

/**
 * Anything may be in `localStorage` — another tab, an older build, or a user
 * with dev tools open. Treat it as untrusted: a malformed entry must not crash
 * the calculator, so parse defensively and fall back to empty.
 */
export function getSavedLoadouts(): readonly LoadoutDraft[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY;
  }

  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;

  if (!raw) {
    cachedValue = EMPTY;
    return cachedValue;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    cachedValue = Array.isArray(parsed) ? parsed.filter(isLoadoutDraft) : EMPTY;
  } catch {
    cachedValue = EMPTY;
  }
  return cachedValue;
}

/** The server has no browser storage, and pretending otherwise is a hydration bug. */
export function getServerSavedLoadouts(): readonly LoadoutDraft[] {
  return EMPTY;
}

export function writeSavedLoadouts(loadouts: readonly LoadoutDraft[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(loadouts));
  } catch {
    // Private browsing and a full quota both throw. Losing a saved loadout is
    // acceptable; breaking the calculator is not.
  }
  // Notify regardless: if the write failed, the next snapshot read reports the
  // truth rather than leaving the UI showing something that was never stored.
  cachedRaw = null;
  notify();
}

function isLoadoutDraft(value: unknown): value is LoadoutDraft {
  return (
    typeof value === 'object' &&
    value !== null &&
    'combatClass' in value &&
    'levels' in value &&
    'gear' in value
  );
}
