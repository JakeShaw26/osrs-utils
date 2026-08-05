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
  /**
   * The OSRS item whose icon stands for this group (ADR-0021, ADR-0022).
   *
   * Required, so a group added later cannot quietly render without one, and
   * `tools.test.ts` asserts every id has packed artwork. **That check is not
   * ceremony:** the icon set comes from the GE price mapping, which covers
   * **tradeables only** — the two ids this group list originally reached for,
   * `995` (Coins) and `2677` (Clue scroll), have no icon at all and would have
   * rendered an empty cell on the landing page.
   */
  itemId: number;
  tools: readonly Tool[];
}

export const TOOL_GROUPS: readonly ToolGroup[] = [
  {
    heading: 'Economy',
    href: '/economy',
    // Gold bar, not coins: 995 is untradeable and so has no icon. Closest
    // readable stand-in for "wealth" in the tradeable set.
    itemId: 2357,
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
    // Dragon scimitar — the red blade is the most legible weapon silhouette in
    // the set at 36px.
    itemId: 4587,
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
    // Casket, not a clue scroll: no clue scroll is tradeable, so none has an
    // icon. The reward casket is the next-best clue signifier and reads as a
    // treasure chest at a glance.
    itemId: 405,
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
    heading: 'Skilling',
    href: '/skilling',
    // Rune pickaxe. A hammer was the other candidate and was rejected on
    // silhouette: at 36px it is the same shape as this, and two groups that
    // look alike defeat the point of the icon.
    itemId: 1275,
    tools: [
      {
        title: 'XP Calculator',
        description: 'XP and actions remaining to a target level, for any skill.',
        href: '/skilling/xp',
      },
      {
        title: 'Training Methods',
        description: 'xp/hr and gp/xp per method, costed against live GE prices.',
        href: '/skilling/methods',
      },
      {
        title: 'Construction Costs',
        description: 'An XP goal turned into a priced plank shopping list.',
        href: '/skilling/construction',
      },
      {
        title: 'Agility Courses',
        description: 'Best course by level, with xp/hr and Marks of Grace rates.',
        href: '/skilling/agility',
      },
    ],
  },
  {
    heading: 'Quests',
    href: '/quests',
    // Papyrus. Nothing quest-flavoured is tradeable — no quest cape, no antique
    // lamp, no diary reward — so this stands for the written list of things to
    // do, which covers the diaries in this group too.
    itemId: 970,
    tools: [
      {
        title: 'Quest Planner',
        description: 'A completable quest order from your levels and what you have done.',
        href: '/quests/planner',
      },
      {
        title: 'Achievement Diaries',
        description: 'Diary tasks by region and tier, against your current levels.',
        href: '/quests/diaries',
      },
    ],
  },
  {
    heading: 'Utility',
    href: '/utility',
    // Prayer potion. The hourglass this replaces has no tradeable equivalent,
    // and the teal is the only cool colour among the six — which is what stops
    // a row of gold-and-brown icons blurring together.
    itemId: 2434,
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
