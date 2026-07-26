import rawCourses from './data/agility-courses.json';
import { actionsRequired, hoursRequired } from './xp';
import type { AgilityCourse, AgilityCoursesFile, RateRange } from './types';

/**
 * Agility course comparator (PRD §3.3: "Course xp/hr and mark rates authored.
 * No API.").
 *
 * Nothing here fetches. Agility has no prices and no upstream — it is entirely
 * authored constants plus arithmetic, which makes it the cheapest tool in the
 * slice to keep correct and the one least able to break in production.
 *
 * Rates are stored as a **range**, not a point. Seers' Village runs at 40k/hr
 * or 56k/hr depending on whether you have the Kandarin Hard diary, and
 * publishing the midpoint as if it were a fact is precisely the "authored
 * estimate presented as truth" failure PRD §3.3 warns about.
 */

const coursesFile = rawCourses as unknown as AgilityCoursesFile;

export const AGILITY_COURSES: readonly AgilityCourse[] = coursesFile.courses;
export const AGILITY_DATA_VERSION = coursesFile.version;
export const AGILITY_DATA_UPDATED = coursesFile.updated;
export const AGILITY_SOURCE = coursesFile.source;

export function midpoint(range: RateRange): number {
  return (range.low + range.high) / 2;
}

export interface CoursePlan {
  course: AgilityCourse;
  /** True when the player cannot enter the course yet. */
  locked: boolean;
  /**
   * True when this is the course usually recommended at the player's level.
   * Advisory: levels are boostable and diaries change the picture.
   */
  recommended: boolean;
  /**
   * Laps needed, rounded up. A single number, not a range: XP per lap is a
   * game constant, so only the *time* to run them is uncertain.
   */
  laps: number | null;
  hours: { low: number; high: number } | null;
  marks: { low: number; high: number } | null;
}

/**
 * Costs every course against an XP goal, at both ends of its rate range.
 *
 * Note the deliberate crossing: the FEWEST hours pair with the HIGHEST xp/hr,
 * so `hours.low` uses `xpPerHour.high`. Getting that backwards is easy and
 * silently produces a table where the best course looks the slowest.
 */
export function compareCourses(
  xpRemaining: number,
  currentLevel: number,
  courses: readonly AgilityCourse[] = AGILITY_COURSES,
): CoursePlan[] {
  return courses.map((course) => {
    const lowHours = hoursRequired(xpRemaining, course.xpPerHour.high);
    const highHours = hoursRequired(xpRemaining, course.xpPerHour.low);

    return {
      course,
      locked: currentLevel < course.minLevel,
      recommended: currentLevel >= course.minLevel && currentLevel < course.recommendedTo,
      laps: actionsRequired(xpRemaining, course.xpPerLap),
      hours:
        lowHours === null || highHours === null
          ? null
          : { low: lowHours, high: highHours },
      marks:
        lowHours === null || highHours === null
          ? null
          : {
              // Marks accrue per hour, so the fewest marks come from the
              // fewest hours — these pair with the SAME end as hours, unlike
              // the xp/hr crossing above.
              low: Math.floor(lowHours * course.marksPerHour.low),
              high: Math.ceil(highHours * course.marksPerHour.high),
            },
    };
  });
}

/** The course a player should be on now — the highest they can enter. */
export function bestCourseForLevel(
  level: number,
  courses: readonly AgilityCourse[] = AGILITY_COURSES,
): AgilityCourse | null {
  const eligible = courses.filter((course) => course.minLevel <= level);
  return eligible[eligible.length - 1] ?? null;
}
