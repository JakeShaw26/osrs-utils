import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Measures WCAG contrast for every semantic token pair the UI actually renders,
 * in BOTH themes, by parsing `globals.css` itself.
 *
 * WHY THIS EXISTS
 *
 * ADR-0020 makes light mode first-class rather than a fallback. That is a claim
 * nothing in the repo could check: no component test can see a contrast ratio,
 * because a component only knows it asked for `text-content-subtle` — whether
 * that token is legible is decided two files away, at runtime, per theme.
 *
 * The re-point to direction B proved the point. It fixed five failing pairs and
 * quietly broke two others: the brighter gold dropped the light-mode focus ring
 * to 2.1:1 (a keyboard-accessibility regression, invisible to every existing
 * test), and light `content-subtle` fell to 2.8:1 behind the `text-2xs` field
 * labels that are now on every calculator. Both were caught by measuring, not
 * by looking.
 *
 * Like `ci-workflow.test.ts`, this reads a different source than the thing it
 * guards — the stylesheet, not the components — because a test that reads the
 * component can only confirm the component says what it says.
 *
 * KNOWN GAP, deliberately not asserted: `--border-strong` against
 * `--surface-raised` is 1.9:1 light / 1.5:1 dark, under the 3:1 WCAG 1.4.11
 * wants for a control boundary. It predates the redesign and raising it makes
 * every input read as heavily outlined. Recorded in docs/theming.md rather than
 * silently fixed.
 */

const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')
  // Comments contain ':' and ';', so they must go before any declaration parsing.
  .replace(/\/\*[\s\S]*?\*\//g, '');

type Tokens = Record<string, string>;

function parseThemes(): { raw: Tokens; light: Tokens; dark: Tokens } {
  const raw: Tokens = {};
  const light: Tokens = {};
  const dark: Tokens = {};
  let rootsSeen = 0;

  for (const match of css.matchAll(/(:root|\.dark)\s*\{([\s\S]*?)\n\}/g)) {
    // The first :root is Layer 1 (the raw palette); the second is the light theme.
    const target = match[1] === '.dark' ? dark : ++rootsSeen === 1 ? raw : light;
    for (const declaration of match[2]!.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
      target[declaration[1]!.trim()] = declaration[2]!.trim();
    }
  }

  return { raw, light, dark };
}

const { raw, light, dark } = parseThemes();

/** Follows `var(--x)` down Layer 2 → Layer 1 until it reaches a literal colour. */
function resolve(value: string | undefined, theme: Tokens): string {
  let current = value ?? '';
  for (let depth = 0; depth < 5 && current.startsWith('var('); depth++) {
    const ref = current.slice(4, -1).trim();
    current = (theme[ref] ?? raw[ref] ?? '').trim();
  }
  return current;
}

function relativeLuminance(hex: string): number {
  const digits = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((offset) => {
    const channel = parseInt(digits.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [
    relativeLuminance(foreground),
    relativeLuminance(background),
  ].sort((a, b) => b - a);
  return (lighter! + 0.05) / (darker! + 0.05);
}

/** [foreground token, background token, minimum ratio, what renders like this] */
const TEXT_PAIRS: ReadonlyArray<readonly [string, string, number, string]> = [
  ['--content', '--surface', 4.5, 'body text on the page'],
  ['--content', '--surface-raised', 4.5, 'body text on a card'],
  ['--content-muted', '--surface', 4.5, 'secondary text'],
  ['--content-muted', '--surface-raised', 4.5, 'secondary text on a card'],
  // text-2xs field labels and fieldset legends — small text, so 4.5:1, not 3:1.
  ['--content-subtle', '--surface', 4.5, 'field labels and legends'],
  ['--content-subtle', '--surface-raised', 4.5, 'field labels on a card'],
  ['--primary-content', '--primary', 4.5, 'primary button label'],
  ['--profit', '--surface-raised', 4.5, 'profit figures'],
  ['--loss', '--surface-raised', 4.5, 'loss figures'],
  ['--success', '--surface-raised', 4.5, 'success messages'],
  ['--danger', '--surface-raised', 4.5, 'validation errors'],
  ['--warning', '--surface-raised', 4.5, 'warnings'],
  ['--info', '--surface-raised', 4.5, 'info messages'],
  ['--members', '--surface-raised', 4.5, 'member and clan figures'],
  // Non-text indicator: 3:1 under WCAG 1.4.11. Checked against every surface it
  // can land on, because a focus ring that vanishes on one of them is unusable.
  ['--focus-ring', '--surface', 3, 'focus ring on the page'],
  ['--focus-ring', '--surface-raised', 3, 'focus ring on a card'],
  ['--focus-ring', '--surface-sunken', 3, 'focus ring on an input'],
];

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme contrast', (_themeName, theme) => {
  it.each(TEXT_PAIRS)('%s on %s clears %d:1 — %s', (fg, bg, minimum) => {
    const foreground = resolve(theme[fg], theme);
    const background = resolve(theme[bg], theme);

    // A typo in a token name resolves to '' and would otherwise throw NaN at the
    // assertion, which reads like a contrast failure rather than a broken test.
    expect(foreground, `${fg} did not resolve to a colour`).toMatch(/^#[0-9a-f]{6}$/i);
    expect(background, `${bg} did not resolve to a colour`).toMatch(/^#[0-9a-f]{6}$/i);

    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(minimum);
  });
});

describe('token structure', () => {
  it('defines the same semantic tokens in both themes', () => {
    // A token defined in only one theme inherits the other's value silently,
    // which is how a dark-mode-only colour ends up on a light background.
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
  });

  it('keeps Layer 1 out of the semantic layers', () => {
    // Layer 2 must reference Layer 1, never restate a hex — otherwise a palette
    // change stops being a one-file edit. #ffffff is the documented exception.
    const literals = Object.entries({ ...light, ...dark }).filter(
      ([, value]) => value.startsWith('#') && value !== '#ffffff',
    );

    expect(literals).toEqual([]);
  });
});
