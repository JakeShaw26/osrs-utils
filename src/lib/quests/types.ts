/**
 * Quest and achievement-diary domain types.
 *
 * THE RULE THIS WHOLE FEATURE RESTS ON
 *
 * Quest and diary *completion* is absent from the Jagex hiscores (verified —
 * docs/api-notes/jagex-hiscores.md). Skill *levels* are present. So everything
 * here is built to answer "what could you achieve from your levels", never
 * "what have you done".
 *
 * That split runs through the types deliberately:
 *
 *   - `PlayerLevels` is knowable. It can be typed in, or pulled from the
 *     hiscores.
 *   - `DeclaredCompletions` is NOT knowable. It is an assertion by the member,
 *     it lives in their browser (ADR-0012 rule 2), and anything rendering it
 *     must label it as self-reported.
 *   - `Requirements` holds only what a solver can evaluate. Requirements that
 *     exist but cannot be checked — "the ability to defeat a level 195 Jungle
 *     Demon", "a trustworthy friend" — live in `otherRequirements`, which the
 *     solver ignores by construction. Folding one into `requirements` would
 *     make the tool confidently wrong.
 */

/**
 * The 24 skills, in the order the Jagex hiscores return them (after Overall),
 * which is also the order players expect to see them in a stats panel.
 */
export const SKILLS = [
  'attack',
  'defence',
  'strength',
  'hitpoints',
  'ranged',
  'prayer',
  'magic',
  'cooking',
  'woodcutting',
  'fletching',
  'fishing',
  'firemaking',
  'crafting',
  'smithing',
  'mining',
  'herblore',
  'agility',
  'thieving',
  'slayer',
  'farming',
  'runecraft',
  'hunter',
  'construction',
  'sailing',
] as const;

export type SkillName = (typeof SKILLS)[number];

const SKILL_SET: ReadonlySet<string> = new Set(SKILLS);

export function isSkillName(value: string): value is SkillName {
  return SKILL_SET.has(value);
}

/** Skills that start above level 1. */
export const SKILL_MINIMUM: Partial<Record<SkillName, number>> = {
  hitpoints: 10,
};

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 99;

/**
 * A member's levels. Partial because manual entry is a first-class path and
 * nobody types 24 numbers to check one quest — an absent skill is treated as
 * its minimum, which is the conservative reading.
 */
export type PlayerLevels = Partial<Record<SkillName, number>>;

/** Quest ids the member says they have finished. Unverifiable by design. */
export type DeclaredCompletions = ReadonlySet<string>;

export type QuestDifficulty =
  'Novice' | 'Intermediate' | 'Experienced' | 'Master' | 'Grandmaster' | 'Special';

export type QuestLength =
  | 'Very Short'
  | 'Short'
  | 'Short – Medium'
  | 'Short – Long'
  | 'Medium'
  | 'Medium – Long'
  | 'Long'
  | 'Very Long';

/** Everything a solver can actually evaluate. Nothing else belongs here. */
export interface Requirements {
  readonly skills?: Readonly<Partial<Record<SkillName, number>>>;
  /** Quest points that must already be banked before starting. */
  readonly questPoints?: number;
  /** Ids of quests that must be complete. Direct edges only — the graph
   *  derives transitive ones, so listing them here would be duplication. */
  readonly quests?: readonly string[];
}

export interface Quest {
  readonly id: string;
  readonly name: string;
  readonly members: boolean;
  /** Miniquests award no quest points but can still gate a real quest. */
  readonly miniquest?: boolean;
  /** Quest points awarded on completion. */
  readonly questPoints: number;
  readonly difficulty: QuestDifficulty;
  readonly length: QuestLength;
  readonly requirements: Requirements;
  /** Skills whose requirement a boost can satisfy — shown, never solved for. */
  readonly boostable?: readonly SkillName[];
  /**
   * Real requirements that cannot be derived from levels: combat ability, a
   * partner, area access. Displayed as unverified; never solved.
   */
  readonly otherRequirements?: readonly string[];
  /** Caveats attached to a specific requirement, e.g. an alternative to it. */
  readonly notes?: readonly string[];
}

export type DiaryTierName = 'Easy' | 'Medium' | 'Hard' | 'Elite';

export const DIARY_TIERS: readonly DiaryTierName[] = ['Easy', 'Medium', 'Hard', 'Elite'];

export interface DiaryRequirements {
  readonly skills?: Readonly<Partial<Record<SkillName, number>>>;
  readonly questPoints?: number;
  readonly combatLevel?: number;
  readonly totalLevel?: number;
}

export interface DiaryTier {
  readonly tier: DiaryTierName;
  readonly requirements: DiaryRequirements;
}

export interface AchievementDiary {
  readonly id: string;
  readonly name: string;
  readonly tiers: readonly DiaryTier[];
}

/* --- Solver output -------------------------------------------------------- */

export type Blocker =
  | {
      readonly kind: 'skill';
      readonly skill: SkillName;
      readonly required: number;
      readonly have: number;
    }
  | { readonly kind: 'questPoints'; readonly required: number; readonly have: number }
  | { readonly kind: 'quest'; readonly questId: string; readonly name: string }
  | { readonly kind: 'combatLevel'; readonly required: number; readonly have: number }
  | { readonly kind: 'totalLevel'; readonly required: number; readonly have: number };

export type QuestState =
  /** The member declared this done. We cannot verify it. */
  | 'declared-complete'
  /** Every checkable requirement is met. */
  | 'available'
  /** Something checkable is missing. */
  | 'blocked';

export interface QuestStatus {
  readonly quest: Quest;
  readonly state: QuestState;
  /** What is missing right now. Empty when `available`. */
  readonly blockers: readonly Blocker[];
}
