import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Structural conventions every route page must follow.
 *
 * These are source-level checks rather than rendering tests on purpose. The
 * defects they catch are *absences* — a missing landmark, a missing template —
 * and a rendering test only ever asserts what the page already does. Reading
 * the source lets the assertion be "every page, no exceptions", which is the
 * form that catches the page nobody thought to write a test for.
 *
 * ## Why the `<main>` rule exists
 *
 * `app/layout.tsx` renders `<body>{children}</body>` with no landmark of its
 * own, so each page must supply its own `<main>`. The landing page did not —
 * it used a bare `<div>`, inherited from the original scaffold — which left
 * screen-reader landmark navigation with nothing to jump to on the site's most
 * visited route. Nothing flagged it, because it renders identically.
 *
 * `CalculatorLayout` renders `<main>` internally, so using it satisfies the
 * rule. That is the intended path; a hand-rolled `<main>` is for index pages
 * that are not calculators.
 */

const APP_DIR = join(process.cwd(), 'src', 'app');

function findPageFiles(
  dir: string = APP_DIR,
  rel = '',
): { route: string; file: string }[] {
  const found: { route: string; file: string }[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'api' || entry.name.startsWith('_')) continue;
      found.push(...findPageFiles(path, `${rel}/${entry.name}`));
    } else if (entry.name === 'page.tsx') {
      found.push({ route: rel === '' ? '/' : rel, file: path });
    }
  }

  return found;
}

const pages = findPageFiles();

describe('page conventions', () => {
  it('finds the pages (guards the test itself)', () => {
    // Without this, a broken walker makes every check below vacuously pass.
    expect(pages.length).toBeGreaterThan(10);
    expect(pages.map((p) => p.route)).toContain('/');
  });

  it.each(pages.map((p) => [p.route, p.file]))(
    '%s provides a <main> landmark',
    (_route, file) => {
      const src = readFileSync(file, 'utf8');
      const hasMain = /<main[\s>]/.test(src);
      const usesTemplate = /CalculatorLayout/.test(src);
      expect(hasMain || usesTemplate).toBe(true);
    },
  );

  it.each(pages.map((p) => [p.route, p.file]))(
    '%s sets width via the width prop, not a conflicting max-w class',
    (_route, file) => {
      const src = readFileSync(file, 'utf8');
      if (!/CalculatorLayout/.test(src)) return;
      // `cn()` joins without merging, so a max-w here lands in the DOM
      // alongside the template's own and resolves by stylesheet order —
      // which silently ignores any attempt to narrow. See CalculatorLayout.
      expect(src).not.toMatch(/className="[^"]*max-w-/);
    },
  );
});
