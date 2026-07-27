/**
 * The tool directory — what the landing page renders, and the single list of
 * every feature group's public entry points.
 *
 * WHY THIS IS DATA IN `lib/` RATHER THAN JSX IN THE PAGE
 *
 * The original landing page hardcoded links to a planned `/tools/*` namespace
 * that was never built — the six feature groups each shipped under their own
 * segment instead, so every link on the home page 404'd, and it reached `main`
 * because nothing could check it. Rendering was the only way to see the links,
 * and no test renders the home page.
 *
 * As plain data it is verifiable without rendering: `tools.test.ts` walks
 * `src/app/` for real `page.tsx` files and asserts every `href` below resolves
 * to one. That makes a dead link a failing test rather than a 404 a user finds.
 *
 * Feature groups own their own `src/app/<group>/` segment (see HANDOFF.md), so
 * this file is the one place the split across groups is visible. Add a row when
 * a group lands.
 */

export interface Tool {
  title: string;
  description: string;
  /** Absolute app route. Must resolve to a real `page.tsx` — enforced by test. */
  href: string;
}

export interface ToolGroup {
  heading: string;
  /** The group's index route. */
  href: string;
  tools: readonly Tool[];
}

export const TOOL_GROUPS: readonly ToolGroup[] = [
  {
    heading: 'Economy',
    href: '/economy',
    tools: [
      {
        title: 'GE Prices',
        description: 'Live Grand Exchange prices and history from the OSRS Wiki API.',
        href: '/economy/prices',
      },
      {
        title: 'Flipping Calculator',
        description: 'Margin, GE tax and ROI, with volume warnings on illiquid items.',
        href: '/economy/flipping',
      },
      {
        title: 'High Alch Profit',
        description: 'Alch value against live buy price and nature rune cost.',
        href: '/economy/high-alch',
      },
    ],
  },
  {
    heading: 'Combat',
    href: '/combat',
    tools: [
      {
        title: 'DPS Calculator',
        description: 'Gear, prayers and boosts against monster stats.',
        href: '/combat/dps',
      },
      {
        title: 'Max Hit',
        description: 'Highest possible hit for a loadout, across all three styles.',
        href: '/combat/max-hit',
      },
      {
        title: 'Drop Rate',
        description: 'Chance of at least one drop over a given number of kills.',
        href: '/combat/drop-rate',
      },
    ],
  },
  {
    heading: 'Clues',
    href: '/clues',
    tools: [
      {
        title: 'Clue Solver',
        description: 'Anagrams, cryptics and coordinates, searchable by clue text.',
        href: '/clues/solver',
      },
      {
        title: 'Combat Achievements',
        description: 'Task list by tier and boss. Progress is tracked in your browser.',
        href: '/clues/combat-achievements',
      },
      {
        title: 'Collection Log',
        description: 'Log slots by source, with self-declared completion.',
        href: '/clues/collection-log',
      },
    ],
  },
  {
    heading: 'Utility',
    href: '/utility',
    tools: [
      {
        title: 'Reset Timers',
        description: 'Daily, weekly and monthly resets in your local timezone.',
        href: '/utility/resets',
      },
      {
        title: 'Prayer Flick',
        description: 'Tick-accurate flicking practice and timing reference.',
        href: '/utility/prayer-flick',
      },
      {
        title: 'Death Risk',
        description: 'What you keep and what you lose, by gear value and location.',
        href: '/utility/death-risk',
      },
      {
        title: 'Minigames',
        description: 'Reward shop rates and points-per-hour comparisons.',
        href: '/utility/minigames',
      },
    ],
  },
] as const;

/** Every href the directory advertises — group index routes and their tools. */
export function allToolHrefs(groups: readonly ToolGroup[] = TOOL_GROUPS): string[] {
  return groups.flatMap((group) => [group.href, ...group.tools.map((t) => t.href)]);
}
