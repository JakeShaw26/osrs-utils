import { StatBadge } from '@/components/atoms/StatBadge';
import type { Blocker, SkillName } from '@/lib/quests/types';

/**
 * MOLECULE — what is standing between the member and a quest or diary tier.
 *
 * Every blocker states both the requirement and what the member currently has,
 * because "needs 53 Thieving" alone leaves them to go and look up their own
 * level. `.tabular` is on both figures so the column of numbers does not
 * jitter as levels are typed (docs/theming.md).
 */

const SKILL_LABEL: Record<SkillName, string> = {
  attack: 'Attack',
  defence: 'Defence',
  strength: 'Strength',
  hitpoints: 'Hitpoints',
  ranged: 'Ranged',
  prayer: 'Prayer',
  magic: 'Magic',
  cooking: 'Cooking',
  woodcutting: 'Woodcutting',
  fletching: 'Fletching',
  fishing: 'Fishing',
  firemaking: 'Firemaking',
  crafting: 'Crafting',
  smithing: 'Smithing',
  mining: 'Mining',
  herblore: 'Herblore',
  agility: 'Agility',
  thieving: 'Thieving',
  slayer: 'Slayer',
  farming: 'Farming',
  runecraft: 'Runecraft',
  hunter: 'Hunter',
  construction: 'Construction',
  sailing: 'Sailing',
};

export function skillLabel(skill: SkillName): string {
  return SKILL_LABEL[skill];
}

function describe(
  blocker: Blocker,
  boostable: readonly SkillName[],
): {
  label: string;
  value: string;
  boost: boolean;
} {
  switch (blocker.kind) {
    case 'skill':
      return {
        label: skillLabel(blocker.skill),
        value: `${blocker.have} / ${blocker.required}`,
        boost: boostable.includes(blocker.skill),
      };
    case 'questPoints':
      return {
        label: 'Quest points',
        value: `${blocker.have} / ${blocker.required}`,
        boost: false,
      };
    case 'combatLevel':
      return {
        label: 'Combat level',
        value: `${blocker.have} / ${blocker.required}`,
        boost: false,
      };
    case 'totalLevel':
      return {
        label: 'Total level',
        value: `${blocker.have} / ${blocker.required}`,
        boost: false,
      };
    case 'quest':
      return { label: 'Quest', value: blocker.name, boost: false };
  }
}

interface BlockerListProps {
  blockers: readonly Blocker[];
  /** Skills a potion can cover — shown, never assumed by the solver. */
  boostable?: readonly SkillName[];
}

export function BlockerList({ blockers, boostable = [] }: BlockerListProps) {
  if (blockers.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-1.5">
      {blockers.map((blocker, index) => {
        const { label, value, boost } = describe(blocker, boostable);
        return (
          <li key={`${blocker.kind}-${index}`}>
            <StatBadge
              label={label}
              value={boost ? `${value} (boostable)` : value}
              tone={blocker.kind === 'quest' ? 'info' : 'danger'}
            />
          </li>
        );
      })}
    </ul>
  );
}
