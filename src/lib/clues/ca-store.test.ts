import { describe, expect, it, vi } from 'vitest';
import { CA_PROGRESS_STORAGE_KEY, type ProgressStorage } from './ca-progress';
import { createCaProgressStore } from './ca-store';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  const storage: ProgressStorage = {
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
  return { storage, data };
}

describe('createCaProgressStore', () => {
  it('returns the same snapshot object until progress changes', () => {
    // Load-bearing, not an optimisation: `useSyncExternalStore` compares
    // snapshots by identity, so a fresh Set on every call would convince React
    // the store changed on every render and loop forever.
    const { storage } = fakeStorage({
      [CA_PROGRESS_STORAGE_KEY]: JSON.stringify({ completedIds: [1] }),
    });
    const store = createCaProgressStore(storage);

    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });

  it('reads existing progress out of storage', () => {
    const { storage } = fakeStorage({
      [CA_PROGRESS_STORAGE_KEY]: JSON.stringify({ completedIds: [4, 9] }),
    });

    expect([...createCaProgressStore(storage).getSnapshot()]).toEqual([4, 9]);
  });

  it('reports empty progress on the server, where there is no storage', () => {
    // This is what prevents a hydration mismatch: the server genuinely knows
    // nothing, and says so, rather than the client's first render disagreeing
    // with the HTML.
    const store = createCaProgressStore(null);

    expect(store.getServerSnapshot().size).toBe(0);
    expect(store.getSnapshot().size).toBe(0);
  });

  it('writes through and notifies subscribers', () => {
    const { storage, data } = fakeStorage();
    const store = createCaProgressStore(storage);
    const listener = vi.fn();
    store.subscribe(listener);

    expect(store.set(new Set([7]))).toBe(true);

    expect(listener).toHaveBeenCalledOnce();
    expect([...store.getSnapshot()]).toEqual([7]);
    expect(JSON.parse(data[CA_PROGRESS_STORAGE_KEY] ?? '').completedIds).toEqual([7]);
  });

  it('stops notifying after unsubscribe', () => {
    const store = createCaProgressStore(fakeStorage().storage);
    const listener = vi.fn();

    store.subscribe(listener)();
    store.set(new Set([1]));

    expect(listener).not.toHaveBeenCalled();
  });

  it('reports a refused write while still updating the UI', () => {
    // A member ticking a box in a browser that blocks storage should see the
    // tick and a warning, not a checkbox that silently springs back.
    const store = createCaProgressStore({
      getItem: () => null,
      setItem() {
        throw new Error('storage disabled');
      },
    });

    expect(store.set(new Set([1]))).toBe(false);
    expect([...store.getSnapshot()]).toEqual([1]);
  });
});
