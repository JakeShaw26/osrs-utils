import {
  exportProfile,
  importProfile,
  PROFILE_STORAGE_KEY,
  type QuestProfile,
} from './profile';

/**
 * `localStorage` as an external store, in the shape `useSyncExternalStore`
 * wants.
 *
 * WHY NOT `useState` + `useEffect`
 *
 * The obvious implementation starts state empty and loads the profile in an
 * effect. That produces a cascading render on every mount (React's
 * `set-state-in-effect` lint rule rejects it), and it needs a `ready` flag to
 * stop the empty initial state overwriting real stored data.
 *
 * `useSyncExternalStore` is what this actually is: an external system React
 * needs to read. It also solves hydration properly — `getServerSnapshot`
 * returns null, so server and first client render agree — and it gives
 * cross-tab synchronisation for free, because the `storage` event fires in
 * every *other* tab when one of them writes.
 *
 * The snapshot is the raw JSON **string**, deliberately. `useSyncExternalStore`
 * compares snapshots with `Object.is`, so returning a freshly parsed object on
 * every call would look like a change every time and re-render forever.
 * Strings compare by value; callers parse once with `useMemo`.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

function storage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    // Storage access throws outright in some privacy configurations.
    return undefined;
  }
}

export function subscribeToProfile(listener: Listener): () => void {
  listeners.add(listener);
  // Fires only in other tabs, which is exactly the case a same-tab write
  // cannot cover — hence both this and the manual notify below.
  window.addEventListener('storage', listener);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

export function getProfileSnapshot(): string | null {
  try {
    return storage()?.getItem(PROFILE_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

/** There is no storage on the server, and pretending otherwise breaks hydration. */
export function getProfileServerSnapshot(): string | null {
  return null;
}

/** Returns false when the write failed, so the UI can warn rather than lie. */
export function writeProfile(profile: QuestProfile): boolean {
  let ok = false;
  try {
    storage()?.setItem(PROFILE_STORAGE_KEY, exportProfile(profile));
    ok = true;
  } catch {
    ok = false;
  }

  // Notify regardless: the in-memory value the caller just derived is what the
  // UI should show even when persistence failed, otherwise a full disk makes
  // the app appear frozen rather than merely forgetful.
  for (const listener of listeners) listener();
  return ok;
}

export function parseSnapshot(raw: string | null): QuestProfile {
  if (raw === null) return { levels: {}, completed: [] };
  const result = importProfile(raw);
  return result.ok ? result.profile : { levels: {}, completed: [] };
}
