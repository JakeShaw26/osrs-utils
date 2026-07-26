'use client';

import { useMemo, useState } from 'react';
import { StatBadge } from '@/components/atoms/StatBadge';
import { NumberField } from '@/components/molecules/combat/NumberField';
import { SelectField, toOptions } from '@/components/molecules/combat/SelectField';
import {
  MAGIC_POTIONS,
  MAGIC_PRAYERS,
  MELEE_PRAYERS,
  POWERED_STAVES,
  RANGED_POTIONS,
  RANGED_PRAYERS,
  SPELL_BASE_MAX_HIT,
  STRENGTH_POTIONS,
  potionBoost,
  type MagicPrayer,
  type MeleePrayer,
  type PoweredStaff,
  type RangedPrayer,
  type StandardSpell,
  type VoidSet,
} from '@/lib/combat/constants';
import { stylesForClass, voidSetsForClass } from '@/lib/combat/defaults';
import {
  magicMaxHit,
  meleeMaxHit,
  rangedMaxHit,
  type MaxHitBreakdown,
  type TargetEffects,
} from '@/lib/combat/max-hit';
import type { AttackStyle, CombatClass } from '@/lib/combat/types';

/**
 * ORGANISM — the maximum hit calculator.
 *
 * A complete, meaningful section of a page: it owns its inputs, calls the
 * domain logic, and renders the result. `"use client"` sits here rather than on
 * the page, so the route stays a server component.
 *
 * **No arithmetic happens in this file.** Every number below comes from
 * `lib/combat`, which is why the formulas are golden-tested without rendering
 * anything (components/README.md rule 3).
 */

const CLASSES: CombatClass[] = ['melee', 'ranged', 'magic'];

const BLACK_MASKS = ['none', 'black mask', 'black mask (i)'] as const;
const SALVES = [
  'none',
  'salve amulet',
  'salve amulet (e)',
  'salve amulet (i)',
  'salve amulet (ei)',
] as const;

type MagicSourceKey = `spell:${StandardSpell}` | `staff:${PoweredStaff}`;

export function MaxHitCalculator() {
  const [combatClass, setCombatClass] = useState<CombatClass>('melee');
  const [style, setStyle] = useState<AttackStyle>('aggressive');
  const [voidSet, setVoidSet] = useState<VoidSet>('none');

  const [level, setLevel] = useState(99);
  const [strengthBonus, setStrengthBonus] = useState(118);

  const [meleePrayer, setMeleePrayer] = useState<MeleePrayer>('Piety');
  const [rangedPrayer, setRangedPrayer] = useState<RangedPrayer>('Rigour');
  const [magicPrayer, setMagicPrayer] = useState<MagicPrayer>('Augury');

  const [meleePotion, setMeleePotion] = useState<keyof typeof STRENGTH_POTIONS>('none');
  const [rangedPotion, setRangedPotion] = useState<keyof typeof RANGED_POTIONS>('none');
  const [magicPotion, setMagicPotion] = useState<keyof typeof MAGIC_POTIONS>('none');

  const [magicSourceKey, setMagicSourceKey] =
    useState<MagicSourceKey>('spell:Fire surge');
  const [magicDamagePercent, setMagicDamagePercent] = useState(0);

  const [blackMask, setBlackMask] = useState<TargetEffects['blackMask']>('none');
  const [onSlayerTask, setOnSlayerTask] = useState(false);
  const [salve, setSalve] = useState<TargetEffects['salve']>('none');

  const [dharoks, setDharoks] = useState(false);
  const [maxHitpoints, setMaxHitpoints] = useState(99);
  const [currentHitpoints, setCurrentHitpoints] = useState(99);

  const target: TargetEffects = { blackMask, onSlayerTask, salve };

  const result: MaxHitBreakdown = useMemo(() => {
    if (combatClass === 'melee') {
      return meleeMaxHit({
        strengthLevel: level,
        strengthBoost: potionBoost(level, STRENGTH_POTIONS[meleePotion]),
        prayer: meleePrayer,
        style,
        strengthBonus,
        void: voidSet,
        target,
        dharoks: dharoks ? { maxHitpoints, currentHitpoints } : undefined,
      });
    }

    if (combatClass === 'ranged') {
      return rangedMaxHit({
        rangedLevel: level,
        rangedBoost: potionBoost(level, RANGED_POTIONS[rangedPotion]),
        prayer: rangedPrayer,
        style,
        rangedStrengthBonus: strengthBonus,
        void: voidSet,
        target,
      });
    }

    const [kind, name] = magicSourceKey.split(':') as ['spell' | 'staff', string];
    return magicMaxHit({
      magicLevel: level,
      magicBoost: potionBoost(level, MAGIC_POTIONS[magicPotion]),
      source:
        kind === 'spell'
          ? { kind: 'spell', spell: name as StandardSpell }
          : { kind: 'powered staff', staff: name as PoweredStaff },
      magicDamagePercent,
      target,
    });
    // `target` is rebuilt every render; its three primitives are the real deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    combatClass,
    style,
    voidSet,
    level,
    strengthBonus,
    meleePrayer,
    rangedPrayer,
    meleePotion,
    rangedPotion,
    magicPotion,
    magicSourceKey,
    magicDamagePercent,
    blackMask,
    onSlayerTask,
    salve,
    dharoks,
    maxHitpoints,
    currentHitpoints,
  ]);

  const levelLabel =
    combatClass === 'melee' ? 'Strength' : combatClass === 'ranged' ? 'Ranged' : 'Magic';

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SelectField
          label="Combat class"
          value={combatClass}
          options={toOptions(CLASSES)}
          onValueChange={(next) => {
            const chosen = next as CombatClass;
            setCombatClass(chosen);
            setStyle(stylesForClass(chosen)[0]);
            setVoidSet('none');
          }}
        />

        <SelectField
          label="Attack style"
          value={style}
          options={toOptions(stylesForClass(combatClass))}
          onValueChange={(next) => setStyle(next as AttackStyle)}
        />

        <SelectField
          label="Void"
          value={voidSet}
          options={toOptions(voidSetsForClass(combatClass))}
          onValueChange={(next) => setVoidSet(next as VoidSet)}
        />

        <NumberField
          label={`${levelLabel} level`}
          value={level}
          min={1}
          max={99}
          onValueChange={(next) => setLevel(clampLevel(next))}
        />

        {combatClass === 'melee' ? (
          <>
            <SelectField
              label="Prayer"
              value={meleePrayer}
              options={toOptions(Object.keys(MELEE_PRAYERS))}
              onValueChange={(next) => setMeleePrayer(next as MeleePrayer)}
            />
            <SelectField
              label="Potion"
              value={meleePotion}
              options={toOptions(Object.keys(STRENGTH_POTIONS))}
              onValueChange={(next) =>
                setMeleePotion(next as keyof typeof STRENGTH_POTIONS)
              }
              hint={`+${potionBoost(level, STRENGTH_POTIONS[meleePotion])} levels`}
            />
          </>
        ) : null}

        {combatClass === 'ranged' ? (
          <>
            <SelectField
              label="Prayer"
              value={rangedPrayer}
              options={toOptions(Object.keys(RANGED_PRAYERS))}
              onValueChange={(next) => setRangedPrayer(next as RangedPrayer)}
            />
            <SelectField
              label="Potion"
              value={rangedPotion}
              options={toOptions(Object.keys(RANGED_POTIONS))}
              onValueChange={(next) =>
                setRangedPotion(next as keyof typeof RANGED_POTIONS)
              }
              hint={`+${potionBoost(level, RANGED_POTIONS[rangedPotion])} levels`}
            />
          </>
        ) : null}

        {combatClass === 'magic' ? (
          <>
            <SelectField
              label="Prayer"
              value={magicPrayer}
              options={toOptions(Object.keys(MAGIC_PRAYERS))}
              onValueChange={(next) => setMagicPrayer(next as MagicPrayer)}
              hint="Magic prayers affect accuracy only"
            />
            <SelectField
              label="Potion"
              value={magicPotion}
              options={toOptions(Object.keys(MAGIC_POTIONS))}
              onValueChange={(next) => setMagicPotion(next as keyof typeof MAGIC_POTIONS)}
              hint={`+${potionBoost(level, MAGIC_POTIONS[magicPotion])} levels`}
            />
            <SelectField
              label="Spell or staff"
              value={magicSourceKey}
              options={[
                ...Object.keys(SPELL_BASE_MAX_HIT).map((spell) => ({
                  value: `spell:${spell}`,
                  label: spell,
                })),
                ...Object.keys(POWERED_STAVES).map((staff) => ({
                  value: `staff:${staff}`,
                  label: staff,
                })),
              ]}
              onValueChange={(next) => setMagicSourceKey(next as MagicSourceKey)}
            />
            <NumberField
              label="Magic damage %"
              value={magicDamagePercent}
              step={0.1}
              onValueChange={(next) => setMagicDamagePercent(next ?? 0)}
              hint="Summed from gear"
            />
          </>
        ) : null}

        {combatClass !== 'magic' ? (
          <NumberField
            label={combatClass === 'melee' ? 'Strength bonus' : 'Ranged strength bonus'}
            value={strengthBonus}
            onValueChange={(next) => setStrengthBonus(next ?? 0)}
            hint="Weapon, armour and ammunition combined"
          />
        ) : null}
      </div>

      <fieldset className="grid gap-4 rounded-card border border-border p-4 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="px-1 text-2xs font-medium tracking-wide text-content-subtle uppercase">
          Target
        </legend>

        <SelectField
          label="Black mask"
          value={blackMask}
          options={toOptions(BLACK_MASKS)}
          onValueChange={(next) => setBlackMask(next as TargetEffects['blackMask'])}
        />

        <label className="flex items-center gap-2 self-end pb-2 text-sm text-content">
          <input
            type="checkbox"
            checked={onSlayerTask}
            onChange={(event) => setOnSlayerTask(event.target.checked)}
            className="size-4 rounded-control border-border"
          />
          On slayer task
        </label>

        <SelectField
          label="Salve amulet"
          value={salve}
          options={toOptions(SALVES)}
          onValueChange={(next) => setSalve(next as TargetEffects['salve'])}
          hint="Undead only. Overrides a black mask rather than stacking"
        />

        {combatClass === 'melee' ? (
          <>
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-content">
              <input
                type="checkbox"
                checked={dharoks}
                onChange={(event) => setDharoks(event.target.checked)}
                className="size-4 rounded-control border-border"
              />
              Dharok&apos;s set
            </label>
            <NumberField
              label="Max hitpoints"
              value={maxHitpoints}
              min={1}
              disabled={!dharoks}
              onValueChange={(next) => setMaxHitpoints(next ?? 1)}
            />
            <NumberField
              label="Current hitpoints"
              value={currentHitpoints}
              min={0}
              disabled={!dharoks}
              onValueChange={(next) => setCurrentHitpoints(next ?? 0)}
            />
          </>
        ) : null}
      </fieldset>

      {/* `<output>` maps to role="status", and the aria-label makes the figure
          itself addressable — by a screen reader announcing the change, and by a
          test asking for the number rather than scraping the panel. */}
      <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-sunken p-4">
        <div className="flex items-baseline gap-3">
          <span className="text-2xs font-medium tracking-wide text-content-subtle uppercase">
            Maximum hit
          </span>
          <output
            aria-label="Maximum hit"
            className="tabular text-4xl font-bold text-content"
          >
            {result.maxHit}
          </output>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatBadge label="Effective level" value={result.effectiveLevel} />
          <StatBadge label="Before target bonuses" value={result.baseMaxHit} />
        </div>
      </div>
    </div>
  );
}

/**
 * An empty or nonsensical level field must not reach the formulas — `NaN`
 * propagates silently all the way to a rendered "NaN", which reads as a crash.
 */
function clampLevel(value: number | null): number {
  if (value === null) return 1;
  return Math.min(99, Math.max(1, Math.floor(value)));
}
