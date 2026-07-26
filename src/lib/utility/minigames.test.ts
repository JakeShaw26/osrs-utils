import { describe, expect, it } from 'vitest';
import { MS_PER_HOUR } from './duration';
import {
  MINIGAMES,
  estimateMs,
  findMinigame,
  pointsAfterRuns,
  runsNeeded,
} from './minigames';

describe('runsNeeded', () => {
  it('divides the shortfall by the rate', () => {
    expect(runsNeeded(5, 100)).toBe(20);
    expect(runsNeeded(5, 100, 40)).toBe(12);
  });

  // A partial game earns nothing, so the count always rounds up. Rounding down
  // tells someone they are finished one game before they are.
  it('rounds up, because a partial run pays nothing', () => {
    expect(runsNeeded(3, 100)).toBe(34);
    expect(runsNeeded(3, 10)).toBe(4);
  });

  it('returns zero when the target is already met', () => {
    expect(runsNeeded(5, 100, 100)).toBe(0);
    expect(runsNeeded(5, 100, 250)).toBe(0);
  });

  // Reachable from the UI by clearing a field. Infinity rendered into a page
  // reads as a crash; null lets the caller show an em dash instead.
  it('returns null rather than Infinity for an unusable rate', () => {
    expect(runsNeeded(0, 100)).toBeNull();
    expect(runsNeeded(-3, 100)).toBeNull();
    expect(runsNeeded(Number.NaN, 100)).toBeNull();
  });

  it('returns null rather than NaN for an unusable target', () => {
    expect(runsNeeded(5, Number.NaN)).toBeNull();
    expect(runsNeeded(5, 100, Number.NaN)).toBeNull();
  });
});

describe('pointsAfterRuns', () => {
  it('projects forward from what you already have', () => {
    expect(pointsAfterRuns(5, 20, 30)).toBe(130);
  });

  // The round trip that matters: the count runsNeeded gives must actually
  // reach the target.
  it('always reaches the target after runsNeeded runs', () => {
    for (const pointsPerRun of [2, 3, 4, 5]) {
      for (const target of [1, 7, 100, 149, 850]) {
        const runs = runsNeeded(pointsPerRun, target);
        expect(runs).not.toBeNull();
        expect(pointsAfterRuns(pointsPerRun, runs as number)).toBeGreaterThanOrEqual(
          target,
        );
      }
    }
  });
});

describe('estimateMs', () => {
  it('converts a run count into playing time', () => {
    expect(estimateMs(12, 12)).toBe(MS_PER_HOUR);
    expect(estimateMs(6, 12)).toBe(MS_PER_HOUR / 2);
  });

  it('returns null for a rate that cannot be divided by', () => {
    expect(estimateMs(10, 0)).toBeNull();
    expect(estimateMs(10, -1)).toBeNull();
  });

  it('is zero when there is nothing left to do', () => {
    expect(estimateMs(0, 12)).toBe(0);
  });
});

describe('the shipped minigame data', () => {
  it('gives every minigame at least one mode and a source', () => {
    for (const minigame of MINIGAMES) {
      expect(minigame.modes.length).toBeGreaterThan(0);
      expect(minigame.source.length).toBeGreaterThan(0);
      expect(minigame.defaultRunsPerHour).toBeGreaterThan(0);
      expect(['documented', 'community', 'unverified']).toContain(minigame.confidence);
    }
  });

  it('never lists a mode worth zero points, which would make the tool divide by nothing', () => {
    for (const minigame of MINIGAMES) {
      for (const mode of minigame.modes) {
        expect(mode.pointsPerRun).toBeGreaterThan(0);
      }
    }
  });

  it('records the Pest Control lander table', () => {
    const pestControl = findMinigame('pest-control');

    expect(pestControl?.modes.map((mode) => mode.pointsPerRun)).toEqual([3, 4, 5]);
  });

  it('records the Mahogany Homes contract tiers', () => {
    const mahoganyHomes = findMinigame('mahogany-homes');

    expect(mahoganyHomes?.modes.map((mode) => mode.pointsPerRun)).toEqual([2, 3, 4, 5]);
  });

  // Anything we cannot source properly must say so in the data, because the UI
  // renders that field — an unmarked guess reads exactly like a fact.
  it('marks anything player-reported rather than documented', () => {
    const castleWars = findMinigame('castle-wars');

    expect(castleWars?.confidence).toBe('community');
  });

  it('returns undefined for an unknown id', () => {
    expect(findMinigame('nope')).toBeUndefined();
  });
});
