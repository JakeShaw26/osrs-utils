'use client';

import { useSyncExternalStore } from 'react';

/**
 * A once-a-second clock that is safe to render on the server.
 *
 * ─── WHY NOT useState + useEffect ───────────────────────────────────────────
 *
 * The obvious version seeds state with null and fills it in an effect:
 *
 *     const [now, setNow] = useState<Date | null>(null);
 *     useEffect(() => { setNow(new Date()); ... }, []);   // ✗
 *
 * That calls setState synchronously inside an effect body, which cascades an
 * extra render pass and which React's own lint rule rejects. `ThemeToggle`
 * hit the same wall for the same reason: the source of truth is *outside*
 * React, and `useSyncExternalStore` is the hook built for "read external
 * state, which has a different value on the server".
 *
 * ─── WHY THE SNAPSHOT IS CACHED ─────────────────────────────────────────────
 *
 * `getSnapshot` must return a *stable* value between store notifications.
 * Returning `Date.now()` directly would hand React a different number on every
 * call, which it reads as "the store changed again" and re-renders in an
 * infinite loop. So the reading is taken once and refreshed only when the
 * interval fires.
 *
 * ─── WHY null ON THE SERVER ─────────────────────────────────────────────────
 *
 * The server cannot know the viewer's clock or timezone, and rendering its own
 * would guarantee a hydration mismatch on a page whose entire subject is time.
 * `getServerSnapshot` returns null so every consumer renders a stable
 * placeholder, and the real clock starts in the browser.
 *
 * ─── WHY setInterval IS ACCEPTABLE HERE ─────────────────────────────────────
 *
 * Each tick re-reads the wall clock rather than adding a second to a counter,
 * so a late or throttled callback produces one stale frame that the next one
 * corrects. Nothing accumulates, so nothing drifts. Contrast the prayer-flick
 * timer, where the beat itself is the product — see lib/utility/tick.ts.
 */

const TICK_MS = 1_000;

let cached: number | null = null;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function notify(): void {
  cached = Date.now();
  for (const listener of listeners) listener();
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  // One interval for every consumer on the page, not one each.
  timer ??= setInterval(notify, TICK_MS);

  return () => {
    listeners.delete(onStoreChange);
    if (listeners.size > 0) return;

    clearInterval(timer);
    timer = undefined;
    // Drop the reading too. A stale cached value would otherwise be the first
    // thing the next mount rendered — visible as a countdown that starts wrong
    // and corrects itself a second later.
    cached = null;
  };
}

function getSnapshot(): number | null {
  cached ??= Date.now();
  return cached;
}

function getServerSnapshot(): number | null {
  return null;
}

/** The current time, or null until the client clock has started. */
export function useClock(): Date | null {
  const ms = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return ms === null ? null : new Date(ms);
}
