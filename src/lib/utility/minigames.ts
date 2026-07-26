import { MS_PER_HOUR } from './duration';

/**
 * Minigame point calculators.
 *
 * Same shape as the death rules, for the same reason: no API publishes these
 * tables, so they are **authored data** and every row carries a `confidence`
 * and a `source`. Jagex adjusts minigame rewards in ordinary game updates, and
 * a hard-coded number with no provenance is impossible to audit later — the
 * next reader cannot tell a transcribed fact from a guess. (ADR-0019)
 *
 * Only two of the three below have tables we consider documented. The third is
 * included with its uncertainty stated in the data and rendered in the UI,
 * which is the honest alternative to either omitting it or quietly presenting
 * a guess with the same authority as a fact.
 */

export const MINIGAME_DATA_VERSION = 'v1 — reviewed 2026-07-26';

export type RuleConfidence = 'documented' | 'community' | 'unverified';

export interface MinigameMode {
  id: string;
  label: string;
  pointsPerRun: number;
}

/** A point total worth aiming at, so the user is not left guessing a number. */
export interface MinigameTarget {
  id: string;
  label: string;
  points: number;
  confidence: RuleConfidence;
}

export interface Minigame {
  id: string;
  name: string;
  /** Singular noun for one attempt — "game", "contract". Used in the copy. */
  runNoun: string;
  /**
   * Non-empty by type, not by convention. `modes[0]` is the fallback whenever a
   * mode id goes stale, and with `noUncheckedIndexedAccess` on, a plain array
   * would make every one of those reads a possible `undefined` the UI would
   * have to defend against for a case the data forbids.
   */
  modes: readonly [MinigameMode, ...MinigameMode[]];
  targets: readonly MinigameTarget[];
  /** Typical completions per hour, used for the time estimate. */
  defaultRunsPerHour: number;
  confidence: RuleConfidence;
  source: string;
  /** Conditions that void the points — the thing people actually get wrong. */
  caveats: readonly string[];
}

export const MINIGAMES: readonly [Minigame, ...Minigame[]] = [
  {
    id: 'pest-control',
    name: 'Pest Control',
    runNoun: 'game',
    modes: [
      { id: 'novice', label: 'Novice lander', pointsPerRun: 3 },
      { id: 'intermediate', label: 'Intermediate lander', pointsPerRun: 4 },
      { id: 'veteran', label: 'Veteran lander', pointsPerRun: 5 },
    ],
    targets: [
      { id: 'gloves', label: 'Void knight gloves', points: 150, confidence: 'community' },
      { id: 'helm', label: 'A Void knight helm', points: 200, confidence: 'community' },
      { id: 'top', label: 'Void knight top', points: 250, confidence: 'community' },
      { id: 'robe', label: 'Void knight robe', points: 250, confidence: 'community' },
      {
        id: 'set',
        label: 'Full Void set (top, robe, gloves, one helm)',
        points: 850,
        confidence: 'community',
      },
    ],
    defaultRunsPerHour: 12,
    confidence: 'documented',
    source: 'OSRS Wiki — “Pest Control”. Reward-shop costs are player-reported.',
    caveats: [
      'You earn nothing at all unless you deal 50 damage to portals or spinners — a game you AFK is a game you wasted.',
      'Points are only awarded when the game is won.',
    ],
  },
  {
    id: 'mahogany-homes',
    name: 'Mahogany Homes',
    runNoun: 'contract',
    modes: [
      { id: 'beginner', label: 'Beginner contract', pointsPerRun: 2 },
      { id: 'novice', label: 'Novice contract', pointsPerRun: 3 },
      { id: 'adept', label: 'Adept contract', pointsPerRun: 4 },
      { id: 'expert', label: 'Expert contract', pointsPerRun: 5 },
    ],
    targets: [],
    defaultRunsPerHour: 25,
    confidence: 'documented',
    source: 'OSRS Wiki — “Mahogany Homes”, carpenter points per contract tier.',
    caveats: [
      'The contract tier you are offered is capped by your Construction level, so the higher rows are not available to everyone.',
      'No reward costs are listed here — enter the point total you are aiming at.',
    ],
  },
  {
    id: 'castle-wars',
    name: 'Castle Wars',
    runNoun: 'game',
    modes: [
      { id: 'win', label: 'Win', pointsPerRun: 3 },
      { id: 'draw', label: 'Draw', pointsPerRun: 2 },
      { id: 'loss', label: 'Loss', pointsPerRun: 1 },
    ],
    targets: [],
    defaultRunsPerHour: 2,
    // Graded down on purpose. We are confident enough to ship it with the
    // uncertainty visible; we are not confident enough to present it as fact.
    confidence: 'community',
    source:
      'Player-reported ticket table. Not confirmed against a primary source — verify before spending hours on it.',
    caveats: [
      'A game runs 20 minutes plus the wait for the next lobby, so the hourly rate is low however the game goes.',
    ],
  },
];

export const DEFAULT_MINIGAME: Minigame = MINIGAMES[0];

export function findMinigame(id: string): Minigame | undefined {
  return MINIGAMES.find((minigame) => minigame.id === id);
}

/** For UI state, where a stale id must degrade rather than blank the page. */
export function findMinigameOrDefault(id: string): Minigame {
  return findMinigame(id) ?? DEFAULT_MINIGAME;
}

/**
 * Completions required to reach `target` points from `current`.
 *
 * Returns null for a nonsensical rate rather than Infinity or NaN. Zero points
 * per run is reachable from the UI (an empty or cleared field), and `Infinity`
 * rendered into a page reads as a crash — null makes the caller decide what an
 * unanswerable question looks like.
 *
 * Already at or past the target returns 0, not a negative count.
 */
export function runsNeeded(
  pointsPerRun: number,
  target: number,
  current: number = 0,
): number | null {
  if (!Number.isFinite(pointsPerRun) || pointsPerRun <= 0) return null;
  if (!Number.isFinite(target) || !Number.isFinite(current)) return null;

  const remaining = target - current;
  if (remaining <= 0) return 0;

  // Ceil, because a partial game earns nothing.
  return Math.ceil(remaining / pointsPerRun);
}

/** Points held after `runs` more completions. */
export function pointsAfterRuns(
  pointsPerRun: number,
  runs: number,
  current: number = 0,
): number {
  return current + pointsPerRun * runs;
}

/** Milliseconds of play for `runs`, or null when the rate is unusable. */
export function estimateMs(runs: number, runsPerHour: number): number | null {
  if (!Number.isFinite(runsPerHour) || runsPerHour <= 0) return null;
  if (!Number.isFinite(runs) || runs < 0) return null;
  return (runs / runsPerHour) * MS_PER_HOUR;
}
