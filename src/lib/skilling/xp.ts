import { MAX_LEVEL, MAX_XP, MIN_LEVEL, XP_AT_MAX_LEVEL, XP_TABLE } from './xp-table';

/**
 * The XP calculator's maths. Pure — no network, no React, no env.
 *
 * Lives here rather than inside the form so the boundaries that actually
 * matter (level 99 vs max XP, rounding an action count) are testable without
 * rendering anything (components/README.md rule 3).
 */

/** Why a plan could not be produced. Discriminated so the UI can phrase each. */
export type XpGoalProblem =
  'target-below-current' | 'target-equals-current' | 'invalid-current' | 'invalid-target';

export interface XpGoal {
  currentLevel: number;
  currentXp: number;
  targetLevel: number;
  targetXp: number;
  /** Always >= 1 when `problem` is undefined. */
  xpRemaining: number;
  /** 0–1 through the current level. 1 once at `XP_AT_MAX_LEVEL` or beyond. */
  progressThroughLevel: number;
  problem?: XpGoalProblem;
}

/**
 * The level a given XP total corresponds to, clamped to 1–99.
 *
 * XP above `XP_AT_MAX_LEVEL` still returns 99: it is the maximum *level*, not
 * the maximum XP. A linear scan is fine — the table is 99 entries and this is
 * called a handful of times per render.
 */
export function levelForXp(xp: number): number {
  if (!Number.isFinite(xp) || xp <= 0) return MIN_LEVEL;

  for (let level = MAX_LEVEL; level >= MIN_LEVEL; level--) {
    // Guarded index: noUncheckedIndexedAccess means this is number | undefined.
    const threshold = XP_TABLE[level - 1];
    if (threshold !== undefined && xp >= threshold) return level;
  }

  return MIN_LEVEL;
}

/**
 * Total XP required to reach `level`.
 *
 * Out-of-range levels clamp rather than throw. A user typing "150" into a
 * target field has made a typo, not triggered an exceptional condition, and the
 * form should show them the level-99 answer while flagging the input — throwing
 * here would make every caller wrap this in a try/catch.
 */
export function xpForLevel(level: number): number {
  if (!Number.isFinite(level)) return 0;
  const clamped = Math.min(Math.max(Math.floor(level), MIN_LEVEL), MAX_LEVEL);
  return XP_TABLE[clamped - 1] ?? 0;
}

/** XP still needed for the next level. Null at level 99 — there is no next. */
export function xpToNextLevel(xp: number): number | null {
  const level = levelForXp(xp);
  if (level >= MAX_LEVEL) return null;
  return xpForLevel(level + 1) - Math.max(xp, 0);
}

/**
 * How far through the current level a total sits, as 0–1.
 *
 * Returns 1 at or beyond level 99 rather than continuing towards `MAX_XP`,
 * because the bar this feeds is a *level* progress bar. Progress towards 200m
 * is a different question with a different denominator.
 */
export function progressThroughLevel(xp: number): number {
  const level = levelForXp(xp);
  if (level >= MAX_LEVEL) return 1;

  const floorXp = xpForLevel(level);
  const ceilingXp = xpForLevel(level + 1);
  const span = ceilingXp - floorXp;
  if (span <= 0) return 1;

  return Math.min(Math.max((Math.max(xp, 0) - floorXp) / span, 0), 1);
}

/** Clamps an XP figure into the range the game can actually hold. */
export function clampXp(xp: number): number {
  if (!Number.isFinite(xp)) return 0;
  return Math.min(Math.max(Math.floor(xp), 0), MAX_XP);
}

interface XpGoalInput {
  /** Where the player is now. */
  currentXp: number;
  /**
   * Where they want to be. Either a target level, or a raw XP total for goals
   * the level table cannot express ("50m Slayer").
   */
  target: { kind: 'level'; level: number } | { kind: 'xp'; xp: number };
}

/**
 * The core calculation: how much XP lies between here and there.
 *
 * Returns a `problem` instead of throwing, so a form can render a message
 * beside the offending field while still showing the rest of the numbers.
 * Target-below-current is the common case — someone types their goal into the
 * "current" box — and it is a normal state, not an exception.
 */
export function planXpGoal({ currentXp, target }: XpGoalInput): XpGoal {
  const validCurrent = Number.isFinite(currentXp) && currentXp >= 0;
  const current = clampXp(validCurrent ? currentXp : 0);

  const rawTarget =
    target.kind === 'level' ? xpForLevel(target.level) : clampXp(target.xp);

  const validTarget =
    target.kind === 'level'
      ? Number.isFinite(target.level) &&
        target.level >= MIN_LEVEL &&
        target.level <= MAX_LEVEL
      : Number.isFinite(target.xp) && target.xp >= 0;

  const base: Omit<XpGoal, 'problem'> = {
    currentLevel: levelForXp(current),
    currentXp: current,
    targetLevel: levelForXp(rawTarget),
    targetXp: rawTarget,
    xpRemaining: Math.max(rawTarget - current, 0),
    progressThroughLevel: progressThroughLevel(current),
  };

  if (!validCurrent) return { ...base, problem: 'invalid-current' };
  if (!validTarget) return { ...base, problem: 'invalid-target' };
  if (rawTarget < current) return { ...base, problem: 'target-below-current' };
  if (rawTarget === current) return { ...base, problem: 'target-equals-current' };

  return base;
}

/**
 * How many repetitions of an action cover `xpRemaining`.
 *
 * ALWAYS ROUNDS UP. You cannot fletch 0.3 of a bow, and rounding to nearest
 * would tell a player they finish an action early — the one direction of error
 * that leaves them short of the goal they asked about.
 *
 * Null when the rate is zero, negative or not a number: "how many actions at
 * 0 xp each" has no answer, and returning Infinity would render as "Infinity".
 */
export function actionsRequired(xpRemaining: number, xpPerAction: number): number | null {
  if (!Number.isFinite(xpPerAction) || xpPerAction <= 0) return null;
  if (!Number.isFinite(xpRemaining) || xpRemaining <= 0) return 0;
  return Math.ceil(xpRemaining / xpPerAction);
}

/**
 * Hours of sustained training to cover `xpRemaining` at `xpPerHour`.
 *
 * Not rounded up — unlike an action count, a partial hour is a real quantity,
 * and rounding 2.1 hours to 3 overstates the grind by nearly a half.
 */
export function hoursRequired(xpRemaining: number, xpPerHour: number): number | null {
  if (!Number.isFinite(xpPerHour) || xpPerHour <= 0) return null;
  if (!Number.isFinite(xpRemaining) || xpRemaining <= 0) return 0;
  return xpRemaining / xpPerHour;
}

/** Every level from `from` to `to` with the XP each one costs. For a table. */
export function levelBreakdown(
  fromLevel: number,
  toLevel: number,
): { level: number; xpAtLevel: number; xpFromPrevious: number }[] {
  const start = Math.min(Math.max(Math.floor(fromLevel), MIN_LEVEL), MAX_LEVEL);
  const end = Math.min(Math.max(Math.floor(toLevel), MIN_LEVEL), MAX_LEVEL);
  if (end <= start) return [];

  const rows = [];
  for (let level = start + 1; level <= end; level++) {
    rows.push({
      level,
      xpAtLevel: xpForLevel(level),
      xpFromPrevious: xpForLevel(level) - xpForLevel(level - 1),
    });
  }
  return rows;
}

export { MAX_LEVEL, MAX_XP, MIN_LEVEL, XP_AT_MAX_LEVEL, XP_TABLE };
