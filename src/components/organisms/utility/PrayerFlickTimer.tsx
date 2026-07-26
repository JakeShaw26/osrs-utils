'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Select } from '@/components/atoms/Select';
import { StatBadge } from '@/components/atoms/StatBadge';
import {
  DEFAULT_FLICK_PATTERN,
  FLICK_PATTERNS,
  GAME_TICK_MS,
  beatProgress,
  beatsElapsed,
  elapsedSeconds,
  findFlickPattern,
  patternIntervalMs,
  ticksElapsed,
} from '@/lib/utility/tick';

/**
 * ORGANISM — the prayer-flicking metronome.
 *
 * ─── THE DESIGN THAT MAKES IT ACCURATE ──────────────────────────────────────
 *
 * State is an **anchor**, never a counter:
 *
 *   `startedAt`      the `performance.now()` reading when the run began
 *   `bankedMs`       elapsed time from previous runs, added on resume
 *
 * Everything on screen is recomputed from `bankedMs + (now - startedAt)` on
 * every animation frame. Nothing is incremented, so nothing can drift: a
 * dropped or late frame yields one stale reading and the next frame is correct
 * again. A `setInterval(fn, 600)` implementation would instead bank each
 * callback's lateness permanently, and a backgrounded tab — throttled to about
 * one callback a second — would run the beat at roughly 60% speed while looking
 * entirely healthy.
 *
 * `requestAnimationFrame` rather than a short interval because it is already
 * synchronised to the display's refresh, so the sweep cannot land mid-paint and
 * tear, and the browser stops calling it when the tab is hidden — which is
 * correct here, since a metronome you cannot see is not doing anything.
 *
 * `performance.now()` rather than `Date.now()`: monotonic, so an NTP correction
 * or a DST change mid-session cannot make elapsed time run backwards.
 *
 * ─── HYDRATION ──────────────────────────────────────────────────────────────
 *
 * The timer starts stopped and at zero, so the server render and the first
 * client render agree trivially. No clock is read until the user presses Start.
 */

export function PrayerFlickTimer() {
  const [patternId, setPatternId] = useState(DEFAULT_FLICK_PATTERN.id);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [bankedMs, setBankedMs] = useState(0);
  const [frameNow, setFrameNow] = useState(0);

  const running = startedAt !== null;
  const pattern = findFlickPattern(patternId);
  const beatMs = patternIntervalMs(pattern.ticks);

  useEffect(() => {
    if (startedAt === null) return;

    let frame = requestAnimationFrame(function step() {
      // Re-read the clock every frame. This single line is the difference
      // between a metronome and a slowly-lying counter.
      setFrameNow(performance.now());
      frame = requestAnimationFrame(step);
    });

    return () => cancelAnimationFrame(frame);
  }, [startedAt]);

  const elapsedMs = running ? bankedMs + Math.max(0, frameNow - startedAt) : bankedMs;

  // Not the updater form of setState: React may invoke an updater twice (Strict
  // Mode does exactly that), and an updater with a side effect would bank the
  // elapsed time twice. Reading the current values from the closure keeps both
  // writes plain and idempotent.
  const toggle = useCallback(() => {
    const now = performance.now();
    if (startedAt === null) {
      setFrameNow(now);
      setStartedAt(now);
      return;
    }
    // Bank what this run earned before dropping the anchor, so Stop then Start
    // resumes rather than silently restarting.
    setBankedMs(bankedMs + Math.max(0, now - startedAt));
    setStartedAt(null);
  }, [startedAt, bankedMs]);

  const reset = useCallback(() => {
    setStartedAt(null);
    setBankedMs(0);
    setFrameNow(0);
  }, []);

  const ticks = ticksElapsed(elapsedMs);
  const beats = beatsElapsed(elapsedMs, beatMs);
  const progress = beatProgress(elapsedMs, beatMs);
  // Alternating so the eye has something to lock onto that is not just a bar
  // sweeping — the switch itself is the cue you are practising.
  const onBeat = beats % 2 === 0;

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <label
          htmlFor="flick-pattern"
          className="text-2xs font-semibold tracking-wide text-content-subtle uppercase"
        >
          Flick rhythm
        </label>
        <Select
          id="flick-pattern"
          value={patternId}
          onChange={(event) => setPatternId(event.target.value)}
          options={FLICK_PATTERNS.map((item) => ({
            value: item.id,
            label: item.label,
          }))}
        />
        <p className="text-sm text-content-muted">{pattern.description}</p>
      </div>

      {/* Hidden from assistive tech on purpose: it flips up to twice a second,
          and the counters below carry the same information without turning the
          page into a stream of announcements. */}
      <div
        className="rounded-card border border-border bg-surface-sunken p-6 text-center"
        aria-hidden
      >
        <div
          className={
            onBeat
              ? 'mx-auto flex size-24 items-center justify-center rounded-card bg-primary text-3xl font-bold text-primary-content'
              : 'mx-auto flex size-24 items-center justify-center rounded-card bg-surface-overlay text-3xl font-bold text-content-subtle'
          }
        >
          {onBeat ? 'ON' : 'OFF'}
        </div>
      </div>

      <div
        role="progressbar"
        aria-label="Progress through the current beat"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        className="h-2 w-full overflow-hidden rounded-control bg-surface-sunken"
      >
        <div
          className="h-full bg-primary"
          // Width is a continuously varying measurement, not one of a fixed set
          // of design values — there is no token that can express "37.4%".
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* role="group" + aria-label so each counter has a real accessible name.
          Deliberately not role="status" or <output>: both are live regions, and
          a value that changes 60 times a second would be announced 60 times a
          second. */}
      <div className="flex flex-wrap gap-2">
        <div role="group" aria-label="Game ticks elapsed">
          <StatBadge label="Ticks" value={ticks} tone="info" />
        </div>
        <div role="group" aria-label="Flicks elapsed">
          <StatBadge label="Flicks" value={beats} tone="info" />
        </div>
        <div role="group" aria-label="Seconds elapsed">
          <StatBadge label="Seconds" value={elapsedSeconds(elapsedMs).toFixed(1)} />
        </div>
        <div role="group" aria-label="Beat length">
          <StatBadge label="Beat" value={`${beatMs} ms`} />
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={toggle}>{running ? 'Stop' : 'Start'}</Button>
        <Button variant="secondary" onClick={reset}>
          Reset
        </Button>
      </div>

      <p className="text-sm text-content-muted">
        One game tick is <span className="tabular">{GAME_TICK_MS}ms</span>. The counter is
        recomputed from a monotonic clock on every frame rather than counted up, so it
        cannot drift away from the server — but your own input latency still can, and no
        timer can fix that.
      </p>
    </div>
  );
}
