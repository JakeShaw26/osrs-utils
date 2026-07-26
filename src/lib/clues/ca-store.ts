import { loadProgress, saveProgress, type ProgressStorage } from './ca-progress';

/**
 * A `useSyncExternalStore`-shaped view over the member's saved progress.
 *
 * ## Why this indirection exists
 *
 * `localStorage` is an external mutable store that React does not own, and the
 * obvious implementation — read it in a `useEffect` and `setState` — is wrong
 * in two specific ways rather than merely inelegant:
 *
 *  1. It renders once with empty progress and then again with the real thing,
 *     so a member with 400 ticked tasks watches them all appear unticked first.
 *  2. Reading it in a `useState` initialiser instead swaps the bug for a
 *     hydration mismatch: the server has no `localStorage`, so its HTML and the
 *     client's first render disagree and React discards the markup.
 *
 * `useSyncExternalStore` is built for exactly this. `getServerSnapshot` returns
 * empty (which is the truth on the server), `getSnapshot` reads the browser,
 * and React reconciles the two without a mismatch.
 *
 * The snapshot **must be referentially stable** between writes — returning a
 * fresh `Set` on every call makes React believe the store changed on every
 * render and loop forever. Caching it here is load-bearing, not an
 * optimisation.
 *
 * Kept out of the component so all of the above is testable under node.
 */

const EMPTY: ReadonlySet<number> = new Set();

export interface CaProgressStore {
  subscribe(onStoreChange: () => void): () => void;
  getSnapshot(): ReadonlySet<number>;
  getServerSnapshot(): ReadonlySet<number>;
  /** Replaces progress and notifies subscribers. False means storage refused. */
  set(ids: ReadonlySet<number>): boolean;
}

export function createCaProgressStore(storage: ProgressStorage | null): CaProgressStore {
  const listeners = new Set<() => void>();
  let snapshot: ReadonlySet<number> | null = null;

  return {
    subscribe(onStoreChange) {
      listeners.add(onStoreChange);
      return () => {
        listeners.delete(onStoreChange);
      };
    },

    getSnapshot() {
      if (!storage) return EMPTY;
      snapshot ??= loadProgress(storage);
      return snapshot;
    },

    getServerSnapshot() {
      return EMPTY;
    },

    set(ids) {
      snapshot = ids;
      for (const listener of listeners) listener();
      return storage ? saveProgress(storage, ids) : false;
    },
  };
}
