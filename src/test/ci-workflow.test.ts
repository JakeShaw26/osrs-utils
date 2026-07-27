import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Keeps `npm run check` and the CI workflow from drifting apart.
 *
 * WHY THIS EXISTS
 *
 * CI used to run `npm run check` verbatim, so the two could not disagree.
 * Splitting CI into parallel jobs bought better failure reporting and created a
 * gap in exchange: the workflow now lists the individual scripts, so adding a
 * step to `check` no longer adds it to CI. Nothing fails — the new step simply
 * never runs on a pull request, and the badge stays green.
 *
 * That is the same shape as every defect this project has actually shipped: an
 * absence, invisible, passing every existing check. So it gets a guard, and the
 * guard reads a DIFFERENT source than the thing it guards — `package.json` on
 * one side, the workflow YAML on the other. A test that read only the workflow
 * could confirm the workflow says what it says, which proves nothing.
 */

const ROOT = process.cwd();

/** `npm run a && npm run b` → `['a', 'b']`. */
function scriptsInvokedBy(command: string): string[] {
  return [...command.matchAll(/npm run ([\w:-]+)/g)].map((m) => m[1]!);
}

describe('CI workflow covers npm run check', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  };

  const workflow = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8');

  // Comments in this workflow legitimately mention `npm run check` and
  // `npm run test:db` in prose. Strip them, or the test would credit CI with
  // running commands that only appear in an explanation.
  const workflowSteps = workflow
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');

  const ranByCi = new Set(scriptsInvokedBy(workflowSteps));
  const composingCheck = scriptsInvokedBy(pkg.scripts.check ?? '');

  it('reads a check script that actually composes others (guards the test)', () => {
    // Without this, a renamed or restructured `check` would make every
    // assertion below vacuously pass instead of failing.
    expect(composingCheck.length).toBeGreaterThan(2);
  });

  it.each(composingCheck)('runs `npm run %s`, which `check` includes', (script) => {
    expect(ranByCi.has(script)).toBe(true);
  });

  it('runs the secret-free build', () => {
    // Not part of `check` — it is the regression test for lazy env validation
    // (hard rule #2) and only means anything when no secrets are set.
    expect(ranByCi.has('build')).toBe(true);
  });

  it('requires every job through the `ci` gate', () => {
    // Branch protection names `ci` alone, so a job missing from `needs` is
    // unprotected while looking protected.
    // Scoped to the `jobs:` block — a two-space key also matches `push:` under
    // `on:`, which is not a job.
    const jobsBlock = workflowSteps.slice(workflowSteps.indexOf('\njobs:'));
    const declared = [...jobsBlock.matchAll(/^ {2}([\w-]+):$/gm)].map((m) => m[1]!);
    const gated = /needs: \[([^\]]+)\]/.exec(jobsBlock)?.[1] ?? '';
    const gatedJobs = gated.split(',').map((j) => j.trim());

    expect(declared).toContain('ci');

    for (const job of declared) {
      if (job === 'ci') continue;
      expect(gatedJobs).toContain(job);
    }
  });
});
