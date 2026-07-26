/**
 * Game-tick maths for the prayer-flicking timer.
 *
 * OSRS runs on a 0.6-second server tick. Prayer flicking exploits the order of
 * operations inside that tick: a prayer switched off and back on within one
 * tick drains no prayer points. The entire value of the tool is that its beat
 * matches the server's, so **drift is the only bug that matters**.
 *
 * ─── WHY EVERY FUNCTION TAKES ELAPSED MILLISECONDS ──────────────────────────
 *
 * The obvious implementation accumulates:
 *
 *     setInterval(() => { ticks += 1; }, 600);          // ✗
 *
 * `setInterval` guarantees *at least* 600ms, never exactly 600ms. Every late
 * callback is absorbed into the counter and never recovered, so error
 * compounds: browsers routinely deliver a few milliseconds late, and a
 * background tab is throttled to roughly one callback per second — which on a
 * 600ms beat means the timer silently runs at about 60% speed. After ten
 * minutes the display bears no relation to the game.
 *
 * Nothing here accumulates. Every value is a pure function of a single elapsed
 * measurement, so a late frame produces one slightly stale reading that the
 * next frame corrects, and error can never build up. The caller derives that
 * measurement from `performance.now()` — a monotonic clock which, unlike
 * `Date.now()`, cannot jump backwards when NTP corrects the system clock or
 * when the user crosses a DST boundary mid-session.
 */

/** 0.6 seconds. The constant the whole game is built on. */
export const GAME_TICK_MS = 600;

/** Whole units in `elapsedMs`. Negative input clamps to 0 rather than counting down. */
function unitsElapsed(elapsedMs: number, unitMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  return Math.floor(elapsedMs / unitMs);
}

/** Position within the current unit, in `[0, unitMs)`. */
function msIntoUnit(elapsedMs: number, unitMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  return elapsedMs % unitMs;
}

/** Whole game ticks elapsed. */
export function ticksElapsed(elapsedMs: number, tickMs: number = GAME_TICK_MS): number {
  return unitsElapsed(elapsedMs, tickMs);
}

/** Whole beats elapsed, where a beat is some whole number of ticks. */
export function beatsElapsed(elapsedMs: number, beatMs: number): number {
  return unitsElapsed(elapsedMs, beatMs);
}

/**
 * Progress through the current beat as `0 → 1`.
 *
 * A fraction rather than a percentage string, so the component owns the
 * presentation and this stays testable without a DOM.
 */
export function beatProgress(elapsedMs: number, beatMs: number): number {
  return msIntoUnit(elapsedMs, beatMs) / beatMs;
}

/** Milliseconds until the next beat boundary, in `(0, beatMs]`. */
export function msUntilNextBeat(elapsedMs: number, beatMs: number): number {
  return beatMs - msIntoUnit(elapsedMs, beatMs);
}

/** Seconds a run has lasted, to one decimal — the figure a user reads back. */
export function elapsedSeconds(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  return Math.round(elapsedMs / 100) / 10;
}

/**
 * Named beats to practise against.
 *
 * Every entry is a whole number of game ticks, because a beat that is not a
 * whole number of ticks drifts against the server by construction — precisely
 * the thing this tool exists to avoid.
 */
export interface FlickPattern {
  id: string;
  label: string;
  ticks: number;
  description: string;
}

export const FLICK_PATTERNS: readonly [FlickPattern, ...FlickPattern[]] = [
  {
    id: 'single',
    label: '1 tick — 0.6s',
    ticks: 1,
    description:
      'The real thing. Off and back on inside a single tick, so no prayer drains.',
  },
  {
    id: 'double',
    label: '2 ticks — 1.2s',
    ticks: 2,
    description: 'Half speed. A gentler rhythm to learn the timing on.',
  },
  {
    id: 'quad',
    label: '4 ticks — 2.4s',
    ticks: 4,
    description: 'Slow metronome for getting the feel without the pressure.',
  },
];

export const DEFAULT_FLICK_PATTERN: FlickPattern = FLICK_PATTERNS[0];

export function findFlickPattern(id: string): FlickPattern {
  return FLICK_PATTERNS.find((pattern) => pattern.id === id) ?? DEFAULT_FLICK_PATTERN;
}

/** Milliseconds per beat for a pattern of `ticks` game ticks. */
export function patternIntervalMs(ticks: number, tickMs: number = GAME_TICK_MS): number {
  return ticks * tickMs;
}
