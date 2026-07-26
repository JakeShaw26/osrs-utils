import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import agilityJson from './data/agility-courses.json';
import constructionJson from './data/construction-builds.json';
import methodsJson from './data/training-methods.json';
import { MAX_LEVEL } from './xp-table';

/**
 * VALIDATES THE AUTHORED JSON AT CI TIME.
 *
 * The runtime path casts these files to their TypeScript types rather than
 * parsing them, because they are bundled static assets and a zod parse on every
 * cold start would buy nothing an attacker could defeat. This test is where the
 * guarantee is actually bought: a malformed hand-edit fails `npm run check`
 * instead of reaching production as `undefined.toFixed()`.
 *
 * It also enforces the rules the type system cannot: that every rate cites a
 * source, that ids are unique, and that a `wiki-guide` basis carries a real URL.
 */

const sourceSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  retrieved: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'ISO date, e.g. 2026-07-26'),
  basis: z.enum(['wiki-guide', 'author-estimate']),
});

const itemQuantitySchema = z.object({
  item: z.string().min(1),
  quantity: z.number().positive(),
});

const methodSchema = z.object({
  id: z.string().min(1),
  skill: z.string().min(1),
  name: z.string().min(1),
  minLevel: z.number().int().min(1).max(MAX_LEVEL),
  xpPerAction: z.number().positive(),
  xpPerHour: z.number().positive(),
  inputs: z.array(itemQuantitySchema),
  outputs: z.array(itemQuantitySchema),
  note: z.string().optional(),
  source: sourceSchema,
});

const rangeSchema = z
  .object({ low: z.number().positive(), high: z.number().positive() })
  .refine((range) => range.high >= range.low, 'high must not be below low');

const courseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  minLevel: z.number().int().min(1).max(MAX_LEVEL),
  xpPerLap: z.number().positive(),
  xpPerHour: rangeSchema,
  marksPerHour: rangeSchema,
  recommendedTo: z.number().int().min(1).max(MAX_LEVEL),
  note: z.string().optional(),
});

const buildSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  room: z.string().min(1),
  minLevel: z.number().int().min(1).max(MAX_LEVEL),
  xpPerBuild: z.number().positive(),
  materials: z.array(itemQuantitySchema).min(1),
  xpPerHour: z.number().positive(),
});

function ids(items: { id: string }[]): string[] {
  return items.map((item) => item.id);
}

describe('training-methods.json', () => {
  const file = z
    .object({
      $comment: z.string(),
      version: z.number().int().positive(),
      updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      methods: z.array(methodSchema).min(1),
    })
    .parse(methodsJson);

  it('parses against the schema', () => {
    expect(file.methods.length).toBeGreaterThan(0);
  });

  it("has unique method ids — they key the user's rate overrides", () => {
    expect(new Set(ids(file.methods)).size).toBe(file.methods.length);
  });

  /**
   * PRD §3.3 requires authored rates to cite their origin, "otherwise every
   * disagreement about rates becomes a bug report". This is that requirement,
   * enforced rather than documented.
   */
  it('cites a source for every single rate', () => {
    for (const method of file.methods) {
      expect(method.source.url, `${method.id} has no source URL`).toMatch(/^https:\/\//);
      expect(method.source.retrieved, `${method.id} has no retrieval date`).toBeTruthy();
    }
  });

  it('never claims a wiki source without a wiki URL', () => {
    for (const method of file.methods) {
      if (method.source.basis === 'wiki-guide') {
        expect(method.source.url, `${method.id} claims a wiki basis`).toContain(
          'runescape.wiki',
        );
      }
    }
  });

  // A method producing more XP per hour than its per-action rate allows in an
  // hour is arithmetically impossible and means one of the two is a typo.
  it('has xp/hr consistent with a plausible actions-per-hour rate', () => {
    for (const method of file.methods) {
      const actionsPerHour = method.xpPerHour / method.xpPerAction;
      expect(actionsPerHour, `${method.id} implies ${actionsPerHour}/hr`).toBeGreaterThan(
        1,
      );
      expect(actionsPerHour, `${method.id} implies ${actionsPerHour}/hr`).toBeLessThan(
        20_000,
      );
    }
  });
});

describe('agility-courses.json', () => {
  const file = z
    .object({
      $comment: z.string(),
      version: z.number().int().positive(),
      updated: z.string(),
      source: sourceSchema,
      courses: z.array(courseSchema).min(1),
    })
    .parse(agilityJson);

  it('parses against the schema', () => {
    expect(file.courses).toHaveLength(9);
  });

  it('has unique course ids', () => {
    expect(new Set(ids(file.courses)).size).toBe(file.courses.length);
  });

  // The comparator relies on this ordering: `bestCourseForLevel` takes the last
  // eligible course, which is only the highest if the list is sorted.
  it('is ordered by ascending level requirement', () => {
    const levels = file.courses.map((course) => course.minLevel);
    expect([...levels].sort((a, b) => a - b)).toEqual(levels);
  });

  it('recommends each course only up to a level above its own requirement', () => {
    for (const course of file.courses) {
      expect(course.recommendedTo, course.id).toBeGreaterThan(course.minLevel);
    }
  });
});

describe('construction-builds.json', () => {
  const file = z
    .object({
      $comment: z.string(),
      version: z.number().int().positive(),
      updated: z.string(),
      source: sourceSchema,
      builds: z.array(buildSchema).min(1),
    })
    .parse(constructionJson);

  it('parses against the schema', () => {
    expect(file.builds.length).toBeGreaterThan(0);
  });

  it('has unique build ids', () => {
    expect(new Set(ids(file.builds)).size).toBe(file.builds.length);
  });

  it('gives every build at least one material', () => {
    for (const build of file.builds) {
      expect(build.materials.length, build.id).toBeGreaterThan(0);
    }
  });
});
