import { describe, expect, it } from 'vitest';
import { AGILITY_COURSES, bestCourseForLevel, compareCourses, midpoint } from './agility';
import type { AgilityCourse } from './types';

const SEERS: AgilityCourse = {
  id: 'seers-village',
  name: "Seers' Village",
  minLevel: 60,
  xpPerLap: 570,
  xpPerHour: { low: 40_000, high: 60_000 },
  marksPerHour: { low: 10, high: 20 },
  recommendedTo: 70,
};

describe('compareCourses', () => {
  /**
   * The crossing that is easy to get backwards: the FEWEST hours come from the
   * HIGHEST xp/hr. Swapping them produces a table where the best course looks
   * the slowest, and it still "looks about right" at a glance.
   */
  it('pairs the fewest hours with the highest xp/hr', () => {
    const [row] = compareCourses(120_000, 70, [SEERS]);

    expect(row!.hours).toEqual({ low: 2, high: 3 });
    expect(row!.hours!.low).toBeLessThan(row!.hours!.high);
  });

  it('rounds laps up — a partial lap awards nothing', () => {
    const [row] = compareCourses(571, 70, [SEERS]);

    expect(row!.laps).toBe(2);
  });

  it('derives marks from the matching end of the hours range', () => {
    const [row] = compareCourses(120_000, 70, [SEERS]);

    expect(row!.marks).toEqual({ low: 20, high: 60 }); // 2h * 10, 3h * 20
  });

  it('marks a course above the player level as locked', () => {
    const [row] = compareCourses(120_000, 50, [SEERS]);

    expect(row!.locked).toBe(true);
    // Still costed, because Agility level is boostable.
    expect(row!.hours).not.toBeNull();
  });

  it('recommends a course only within its own level band', () => {
    expect(compareCourses(1000, 65, [SEERS])[0]!.recommended).toBe(true);
    expect(compareCourses(1000, 59, [SEERS])[0]!.recommended).toBe(false);
    expect(compareCourses(1000, 70, [SEERS])[0]!.recommended).toBe(false);
  });

  it('produces zeroes rather than nulls for a goal already met', () => {
    const [row] = compareCourses(0, 70, [SEERS]);

    expect(row!.laps).toBe(0);
    expect(row!.hours).toEqual({ low: 0, high: 0 });
    expect(row!.marks).toEqual({ low: 0, high: 0 });
  });

  it('costs every shipped course without throwing', () => {
    const rows = compareCourses(13_034_431, 1);

    expect(rows).toHaveLength(AGILITY_COURSES.length);
    for (const row of rows) {
      expect(row.laps, row.course.id).not.toBeNull();
      expect(row.hours, row.course.id).not.toBeNull();
    }
  });
});

describe('bestCourseForLevel', () => {
  it('returns the highest course the player can enter', () => {
    expect(bestCourseForLevel(1)?.id).toBe('draynor');
    expect(bestCourseForLevel(49)?.id).toBe('canifis');
    expect(bestCourseForLevel(50)?.id).toBe('falador');
    expect(bestCourseForLevel(59)?.id).toBe('falador');
    expect(bestCourseForLevel(60)?.id).toBe('seers-village');
    expect(bestCourseForLevel(99)?.id).toBe('ardougne');
  });

  it('returns null when no course is reachable', () => {
    expect(bestCourseForLevel(0, [SEERS])).toBeNull();
  });
});

describe('midpoint', () => {
  it('averages a range', () => {
    expect(midpoint({ low: 40_000, high: 60_000 })).toBe(50_000);
  });
});
