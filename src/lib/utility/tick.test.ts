import { describe, expect, it } from 'vitest';
import {
  FLICK_PATTERNS,
  GAME_TICK_MS,
  beatProgress,
  beatsElapsed,
  elapsedSeconds,
  findFlickPattern,
  msUntilNextBeat,
  patternIntervalMs,
  ticksElapsed,
} from './tick';

describe('ticksElapsed', () => {
  it('counts whole ticks only', () => {
    expect(ticksElapsed(0)).toBe(0);
    expect(ticksElapsed(599)).toBe(0);
    expect(ticksElapsed(600)).toBe(1);
    expect(ticksElapsed(1199)).toBe(1);
    expect(ticksElapsed(1200)).toBe(2);
  });

  /**
   * The regression this module exists for.
   *
   * An accumulating `setInterval` implementation banks every callback's
   * lateness permanently. Simulating ten minutes of callbacks that are 4ms late
   * — an entirely ordinary browser figure — the accumulator loses several
   * seconds, while deriving from elapsed time cannot lose anything, because
   * nothing is stored.
   */
  it('cannot drift, however late the samples arrive', () => {
    const TEN_MINUTES = 600_000;

    let accumulated = 0;
    let clock = 0;
    while (clock < TEN_MINUTES) {
      clock += GAME_TICK_MS + 4; // each callback fires 4ms late
      accumulated += 1;
    }

    const derived = ticksElapsed(TEN_MINUTES);

    expect(derived).toBe(1000);
    // The accumulator is short by nearly seven ticks after ten minutes.
    expect(accumulated).toBeLessThan(derived);
    expect(derived - accumulated).toBeGreaterThan(5);
  });

  it('is unaffected by a dropped frame — the next reading is already correct', () => {
    // A tab hidden for 30 seconds delivers no frames at all. The first frame
    // after it returns reports the true elapsed count, not 1.
    expect(ticksElapsed(30_000)).toBe(50);
  });

  it('clamps negative and non-finite elapsed time to zero', () => {
    expect(ticksElapsed(-1)).toBe(0);
    expect(ticksElapsed(Number.NaN)).toBe(0);
  });
});

describe('beatsElapsed', () => {
  it('counts a multi-tick beat', () => {
    const twoTicks = patternIntervalMs(2);

    expect(twoTicks).toBe(1200);
    expect(beatsElapsed(1199, twoTicks)).toBe(0);
    expect(beatsElapsed(1200, twoTicks)).toBe(1);
    expect(beatsElapsed(3600, twoTicks)).toBe(3);
  });
});

describe('beatProgress', () => {
  it('sweeps 0 → 1 within a beat and resets at the boundary', () => {
    expect(beatProgress(0, GAME_TICK_MS)).toBe(0);
    expect(beatProgress(300, GAME_TICK_MS)).toBe(0.5);
    expect(beatProgress(599, GAME_TICK_MS)).toBeCloseTo(0.998, 3);
    expect(beatProgress(600, GAME_TICK_MS)).toBe(0);
  });

  it('never leaves the 0–1 range', () => {
    for (let ms = 0; ms < 5_000; ms += 7) {
      const progress = beatProgress(ms, GAME_TICK_MS);
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThan(1);
    }
  });
});

describe('msUntilNextBeat', () => {
  it('returns a full beat at the boundary, never zero', () => {
    // Zero would mean "the beat is now" forever on a frame that lands exactly
    // on the boundary. The next beat is always strictly ahead.
    expect(msUntilNextBeat(0, GAME_TICK_MS)).toBe(600);
    expect(msUntilNextBeat(600, GAME_TICK_MS)).toBe(600);
    expect(msUntilNextBeat(100, GAME_TICK_MS)).toBe(500);
  });
});

describe('elapsedSeconds', () => {
  it('reports one decimal place', () => {
    expect(elapsedSeconds(0)).toBe(0);
    expect(elapsedSeconds(1234)).toBe(1.2);
    expect(elapsedSeconds(1250)).toBe(1.3);
  });

  it('clamps negatives', () => {
    expect(elapsedSeconds(-500)).toBe(0);
  });
});

describe('FLICK_PATTERNS', () => {
  // A beat that is not a whole number of ticks drifts against the server by
  // construction, which is the one thing this tool must not do.
  it('are all whole numbers of game ticks', () => {
    for (const pattern of FLICK_PATTERNS) {
      expect(Number.isInteger(pattern.ticks)).toBe(true);
      expect(pattern.ticks).toBeGreaterThan(0);
      expect(patternIntervalMs(pattern.ticks) % GAME_TICK_MS).toBe(0);
    }
  });

  it('falls back to the default for an unknown id rather than crashing', () => {
    expect(findFlickPattern('nonsense').id).toBe(FLICK_PATTERNS[0].id);
  });
});
