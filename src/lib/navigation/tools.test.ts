import { describe, expect, it } from 'vitest';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { TOOL_GROUPS, allToolHrefs } from './tools';

/**
 * Link integrity for the landing page.
 *
 * This exists because of a real defect: the scaffold advertised `/tools/prices`,
 * `/tools/dps` and four more that were never built, and it reached `main`
 * unnoticed. Nothing in the suite could have caught it — the links were only
 * observable by rendering, and a rendering test asserting `href="/tools/prices"`
 * would have passed just as happily, because it would only prove the page
 * renders what the page says.
 *
 * So this checks the list against the *filesystem* instead. `src/app/` is the
 * routing table; a route exists if and only if a `page.tsx` sits at its path.
 * Comparing the advertised list to that is the mechanical correctness check the
 * last handoff asked for by name — the assertion cannot be satisfied by
 * restating the thing under test.
 *
 * Dynamic segments (`[id]`) are deliberately not resolvable here and are never
 * linked directly from the directory.
 */

const APP_DIR = join(process.cwd(), 'src', 'app');

/**
 * Routes that legitimately belong to no tool group.
 *
 * Keep this list short and justified. Adding a route here to silence the
 * "advertised" test below is how a feature quietly becomes unreachable.
 */
const EXEMPT_FROM_DIRECTORY = new Set<string>([]);

/** Walks `src/app/` and returns every static route that has a `page.tsx`. */
function discoverRoutes(dir: string = APP_DIR, prefix = ''): string[] {
  const routes: string[] = [];

  if (existsSync(join(dir, 'page.tsx'))) {
    routes.push(prefix === '' ? '/' : prefix);
  }

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    // Dynamic segments can't be matched against a literal href, and route
    // groups `(name)` don't appear in the URL at all — neither is linked here.
    if (entry.name.startsWith('[') || entry.name.startsWith('(')) continue;
    if (entry.name.startsWith('_') || entry.name === 'api') continue;

    routes.push(...discoverRoutes(join(dir, entry.name), `${prefix}/${entry.name}`));
  }

  return routes;
}

describe('tool directory links', () => {
  const routes = new Set(discoverRoutes());

  it('discovers the app routing table (guards the test itself)', () => {
    // If the walker silently found nothing, every assertion below would be
    // vacuous rather than failing — so assert it works before trusting it.
    expect(routes.has('/')).toBe(true);
    expect(routes.size).toBeGreaterThan(5);
  });

  it.each(allToolHrefs())('%s resolves to a real page', (href) => {
    expect(routes.has(href)).toBe(true);
  });

  it('advertises no duplicate hrefs', () => {
    const hrefs = allToolHrefs();
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('uses absolute paths with no trailing slash', () => {
    for (const href of allToolHrefs()) {
      expect(href.startsWith('/')).toBe(true);
      expect(href.endsWith('/')).toBe(false);
    }
  });

  it('advertises every feature route that exists', () => {
    /**
     * The reverse of the check above, and the one that was missing.
     *
     * `allToolHrefs()` → filesystem catches a link to a page that does not
     * exist. It cannot catch a page that exists but is linked from nowhere —
     * which is the likelier failure now that feature groups land as whole
     * slices: /skilling and /quests each shipped five and three routes that the
     * landing page said nothing about, and every existing test stayed green.
     *
     * A page nobody can navigate to is not shipped, however well it renders.
     */
    const advertised = new Set(allToolHrefs());
    const featureRoutes = [...routes].filter(
      (route) => route !== '/' && !EXEMPT_FROM_DIRECTORY.has(route),
    );

    expect(featureRoutes.filter((route) => !advertised.has(route))).toEqual([]);
  });

  it('nests every tool under its own group segment', () => {
    // Catches a tool pasted into the wrong group — a copy-paste error that
    // otherwise renders perfectly and sends people to the wrong place.
    for (const group of TOOL_GROUPS) {
      for (const tool of group.tools) {
        expect(tool.href.startsWith(`${group.href}/`)).toBe(true);
      }
    }
  });
});
