import { describe, expect, it } from 'vitest';
import {
  actionsRequired,
  hoursRequired,
  levelBreakdown,
  levelForXp,
  planXpGoal,
  progressThroughLevel,
  xpForLevel,
  xpToNextLevel,
} from './xp';
import { MAX_LEVEL, MAX_XP, XP_AT_MAX_LEVEL, XP_TABLE } from './xp-table';

describe('levelForXp', () => {
  it.each([
    [0, 1],
    [82, 1], // one short of level 2
    [83, 2], // exactly level 2
    [84, 2],
    [6_517_252, 91], // one short of 92
    [6_517_253, 92], // exactly 92 — half the XP to 99
    [11_805_605, 97],
    [11_805_606, 98],
    [13_034_430, 98], // one short of 99
    [13_034_431, 99],
  ])('reads %i XP as level %i', (xp, expected) => {
    expect(levelForXp(xp)).toBe(expected);
  });

  /**
   * The boundary this calculator exists to get right. 99 is the maximum LEVEL;
   * 200m is the maximum XP. A player with 50m Slayer is level 99 with 150m
   * still to gain, and clamping XP at 13,034,431 would erase that.
   */
  it('caps at level 99 for XP above the level-99 threshold', () => {
    expect(levelForXp(XP_AT_MAX_LEVEL + 1)).toBe(MAX_LEVEL);
    expect(levelForXp(50_000_000)).toBe(MAX_LEVEL);
    expect(levelForXp(MAX_XP)).toBe(MAX_LEVEL);
  });

  it('floors at level 1 for negative or nonsense input', () => {
    expect(levelForXp(-1)).toBe(1);
    expect(levelForXp(Number.NaN)).toBe(1);
    expect(levelForXp(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe('xpForLevel', () => {
  it.each([
    [1, 0],
    [2, 83],
    [92, 6_517_253],
    [98, 11_805_606],
    [99, 13_034_431],
  ])('level %i costs %i XP', (level, expected) => {
    expect(xpForLevel(level)).toBe(expected);
  });

  // Clamps rather than throwing: "150" is a typo in a form field, and every
  // caller wrapping this in a try/catch would be worse than a clamped answer
  // beside a validation message.
  it('clamps out-of-range levels instead of throwing', () => {
    expect(xpForLevel(0)).toBe(0);
    expect(xpForLevel(-5)).toBe(0);
    expect(xpForLevel(150)).toBe(13_034_431);
    expect(xpForLevel(Number.NaN)).toBe(0);
  });

  it('truncates a fractional level rather than interpolating', () => {
    expect(xpForLevel(70.9)).toBe(xpForLevel(70));
  });
});

describe('round-tripping levels and XP', () => {
  it('returns the same level for the exact XP of every level', () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      expect(levelForXp(xpForLevel(level))).toBe(level);
    }
  });

  it('returns the level below for one XP short of every threshold', () => {
    for (let level = 2; level <= MAX_LEVEL; level++) {
      expect(levelForXp(xpForLevel(level) - 1)).toBe(level - 1);
    }
  });
});

describe('xpToNextLevel', () => {
  it('reports the gap to the next threshold', () => {
    expect(xpToNextLevel(0)).toBe(83);
    expect(xpToNextLevel(83)).toBe(174 - 83);
  });

  // Null, not 0. "You need 0 more XP" reads as "you are about to level up".
  it('is null at level 99 because there is no next level', () => {
    expect(xpToNextLevel(XP_AT_MAX_LEVEL)).toBeNull();
    expect(xpToNextLevel(50_000_000)).toBeNull();
  });
});

describe('progressThroughLevel', () => {
  it('is 0 at the start of a level and approaches 1 at the end', () => {
    expect(progressThroughLevel(xpForLevel(70))).toBe(0);
    expect(progressThroughLevel(xpForLevel(71) - 1)).toBeGreaterThan(0.99);
  });

  it('is 1 at and beyond level 99', () => {
    expect(progressThroughLevel(XP_AT_MAX_LEVEL)).toBe(1);
    expect(progressThroughLevel(MAX_XP)).toBe(1);
  });
});

describe('planXpGoal', () => {
  it('computes the XP between a current total and a target level', () => {
    const goal = planXpGoal({ currentXp: 737_627, target: { kind: 'level', level: 99 } });

    expect(goal.currentLevel).toBe(70);
    expect(goal.targetLevel).toBe(99);
    expect(goal.xpRemaining).toBe(13_034_431 - 737_627);
    expect(goal.problem).toBeUndefined();
  });

  it('accepts a raw XP target for goals past level 99', () => {
    const goal = planXpGoal({
      currentXp: 13_034_431,
      target: { kind: 'xp', xp: 50_000_000 },
    });

    expect(goal.currentLevel).toBe(99);
    expect(goal.xpRemaining).toBe(50_000_000 - 13_034_431);
    expect(goal.problem).toBeUndefined();
  });

  // The commonest user error: typing the goal into the "current" box.
  it('flags a target below the current total without throwing', () => {
    const goal = planXpGoal({
      currentXp: 1_000_000,
      target: { kind: 'level', level: 50 },
    });

    expect(goal.problem).toBe('target-below-current');
    expect(goal.xpRemaining).toBe(0);
    // The other figures stay usable so the form can still render them.
    expect(goal.currentLevel).toBe(73);
  });

  it('distinguishes "already there" from "going backwards"', () => {
    const goal = planXpGoal({ currentXp: 101_333, target: { kind: 'level', level: 50 } });

    expect(goal.problem).toBe('target-equals-current');
    expect(goal.xpRemaining).toBe(0);
  });

  it('flags an out-of-range target level', () => {
    expect(
      planXpGoal({ currentXp: 0, target: { kind: 'level', level: 120 } }).problem,
    ).toBe('invalid-target');
    expect(
      planXpGoal({ currentXp: 0, target: { kind: 'level', level: 0 } }).problem,
    ).toBe('invalid-target');
  });

  it('flags a negative or non-numeric current total', () => {
    expect(
      planXpGoal({ currentXp: -5, target: { kind: 'level', level: 99 } }).problem,
    ).toBe('invalid-current');
    expect(
      planXpGoal({ currentXp: Number.NaN, target: { kind: 'level', level: 99 } }).problem,
    ).toBe('invalid-current');
  });

  it('clamps a target above the XP ceiling rather than promising the impossible', () => {
    const goal = planXpGoal({ currentXp: 0, target: { kind: 'xp', xp: 500_000_000 } });

    expect(goal.targetXp).toBe(MAX_XP);
  });
});

describe('actionsRequired', () => {
  /**
   * ALWAYS ROUNDS UP. Rounding to nearest would tell a player they finish early
   * — the one direction of error that leaves them short of the goal they asked
   * about.
   */
  it('rounds up, never to nearest', () => {
    expect(actionsRequired(100, 75)).toBe(2); // 1.33 -> 2, not 1
    expect(actionsRequired(101, 100)).toBe(2); // 1.01 -> 2
    expect(actionsRequired(149, 100)).toBe(2); // 1.49 -> 2, not 1
    expect(actionsRequired(151, 100)).toBe(2); // 1.51 -> 2
  });

  it('does not round up an exact multiple', () => {
    expect(actionsRequired(300, 75)).toBe(4);
    expect(actionsRequired(13_034_431, 13_034_431)).toBe(1);
  });

  it('handles the fractional XP rates real methods have', () => {
    // Maple longbows are 58.3 XP each — a rate that never divides evenly.
    expect(actionsRequired(583, 58.3)).toBe(10);
    expect(actionsRequired(584, 58.3)).toBe(11);
  });

  it('is 0 when the goal is already met', () => {
    expect(actionsRequired(0, 75)).toBe(0);
    expect(actionsRequired(-100, 75)).toBe(0);
  });

  // Null rather than Infinity: "Infinity actions" is what renders on screen.
  it('is null for a zero, negative or non-numeric rate', () => {
    expect(actionsRequired(1000, 0)).toBeNull();
    expect(actionsRequired(1000, -75)).toBeNull();
    expect(actionsRequired(1000, Number.NaN)).toBeNull();
  });
});

describe('hoursRequired', () => {
  // Unlike an action count, a partial hour is a real quantity — rounding 2.1
  // hours up to 3 overstates the grind by nearly half.
  it('does not round up', () => {
    expect(hoursRequired(150_000, 100_000)).toBe(1.5);
  });

  it('is null for a non-positive rate', () => {
    expect(hoursRequired(1000, 0)).toBeNull();
    expect(hoursRequired(1000, -1)).toBeNull();
  });

  it('is 0 when nothing is left', () => {
    expect(hoursRequired(0, 100_000)).toBe(0);
  });
});

describe('levelBreakdown', () => {
  it('lists every level between the two, exclusive of the start', () => {
    const rows = levelBreakdown(70, 73);

    expect(rows.map((row) => row.level)).toEqual([71, 72, 73]);
    expect(rows[0]!.xpAtLevel).toBe(XP_TABLE[70]);
    expect(rows[0]!.xpFromPrevious).toBe(XP_TABLE[70]! - XP_TABLE[69]!);
  });

  it('is empty when the target is not above the start', () => {
    expect(levelBreakdown(99, 99)).toEqual([]);
    expect(levelBreakdown(80, 70)).toEqual([]);
  });
});
