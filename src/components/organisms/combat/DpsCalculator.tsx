'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/atoms/Button';
import { StatBadge } from '@/components/atoms/StatBadge';
import {
  Table,
  TableBody,
  TableCell,
  TableEmptyRow,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/components/atoms/Table';
import { NumericField } from '@/components/molecules/NumericField';
import { SelectField, toOptions } from '@/components/molecules/SelectField';
import {
  ATTACK_POTIONS,
  MAGIC_POTIONS,
  MAGIC_PRAYERS,
  MELEE_PRAYERS,
  POWERED_STAVES,
  RANGED_POTIONS,
  RANGED_PRAYERS,
  SPELL_BASE_MAX_HIT,
  STRENGTH_POTIONS,
  type MagicPrayer,
  type MeleePrayer,
  type RangedPrayer,
  type VoidSet,
} from '@/lib/combat/constants';
import { MONSTERS } from '@/lib/combat/data/monsters.generated';
import {
  attackTypesForClass,
  isUndead,
  stylesForClass,
  voidSetsForClass,
} from '@/lib/combat/defaults';
import { calculateDps, compareLoadouts } from '@/lib/combat/dps';
import {
  draftToSetup,
  emptyDraft,
  monsterKey,
  type LoadoutDraft,
  type MagicSourceKey,
} from '@/lib/combat/draft';
import { itemsForSlot, LOADOUT_SLOTS } from '@/lib/combat/loadout';
import type { TargetEffects } from '@/lib/combat/max-hit';
import {
  getSavedLoadouts,
  getServerSavedLoadouts,
  subscribeToSavedLoadouts,
  writeSavedLoadouts,
} from '@/lib/combat/saved-loadouts';
import type {
  AttackStyle,
  AttackType,
  CombatClass,
  EquipmentSlot,
} from '@/lib/combat/types';

/**
 * ORGANISM — the DPS calculator and gear comparison.
 *
 * One engine, N loadouts, one monster. Saved loadouts persist to
 * `localStorage` and never to our database: there is no sign-in, so there is no
 * account to attach them to and no trusted write path to accept them
 * (ADR-0012, hard rules 5 and 6).
 *
 * No upstream request happens here or on the page that renders it. Monster and
 * equipment stats are pre-aggregated into the repo at build time, so this route
 * cannot become the open proxy that a public, auth-free app otherwise invites
 * (PRD §5.3). That is also why it needs no rate limiter.
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

const MONSTER_OPTIONS = MONSTERS.map((monster) => ({
  value: monsterKey(monster),
  label: `${monster.name} — ${monster.version}`,
}));

export function DpsCalculator() {
  const [selectedMonster, setSelectedMonster] = useState(MONSTER_OPTIONS[0]?.value ?? '');
  const [draft, setDraft] = useState<LoadoutDraft>(() => emptyDraft('Current setup'));

  // Browser storage is an external system, so it is subscribed to rather than
  // copied into state. The server snapshot is empty because the server has no
  // localStorage — anything else is a hydration mismatch.
  const saved = useSyncExternalStore(
    subscribeToSavedLoadouts,
    getSavedLoadouts,
    getServerSavedLoadouts,
  );

  const monster = MONSTERS.find((entry) => monsterKey(entry) === selectedMonster);

  const setup = useMemo(() => draftToSetup(draft, monster), [draft, monster]);
  const result = useMemo(
    () => (monster ? calculateDps(setup, monster) : null),
    [setup, monster],
  );

  const comparison = useMemo(() => {
    if (!monster) return [];
    return compareLoadouts(
      [
        { id: 'current', name: draft.name || 'Current setup', setup },
        ...saved.map((entry, index) => ({
          id: `saved-${index}`,
          name: entry.name,
          setup: draftToSetup(entry, monster),
        })),
      ],
      monster,
    );
  }, [monster, setup, saved, draft.name]);

  const update = (patch: Partial<LoadoutDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));

  const salveUseless = monster !== undefined && !isUndead(monster.attributes);

  return (
    <div className="flex flex-col gap-6">
      <SelectField
        id="dps-monster"
        label="Monster"
        value={selectedMonster}
        options={MONSTER_OPTIONS}
        onChange={setSelectedMonster}
        hint="Monsters with several forms are listed once per form — they have different defences"
      />

      {monster ? (
        <div className="flex flex-wrap gap-2">
          <StatBadge label="Hitpoints" value={monster.hitpoints} />
          <StatBadge label="Defence" value={monster.defence} />
          <StatBadge label="Magic" value={monster.magic} />
          <StatBadge label="Stab def" value={monster.stabDefence} />
          <StatBadge label="Slash def" value={monster.slashDefence} />
          <StatBadge label="Crush def" value={monster.crushDefence} />
          <StatBadge label="Ranged def" value={monster.rangedDefence} />
          <StatBadge label="Magic def" value={monster.magicDefence} />
          {isUndead(monster.attributes) ? <StatBadge tone="info" value="Undead" /> : null}
        </div>
      ) : null}

      <fieldset className="grid gap-4 rounded-card border border-border p-4 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="px-1 text-2xs font-medium tracking-wide text-content-subtle uppercase">
          Style
        </legend>

        <SelectField
          id="dps-class"
          label="Combat class"
          value={draft.combatClass}
          options={toOptions(CLASSES)}
          onChange={(next) => {
            const chosen = next as CombatClass;
            update({
              combatClass: chosen,
              attackType: attackTypesForClass(chosen)[0],
              style: stylesForClass(chosen)[0],
              void: 'none',
            });
          }}
        />
        <SelectField
          id="dps-attack-type"
          label="Attack type"
          value={draft.attackType}
          options={toOptions(attackTypesForClass(draft.combatClass))}
          onChange={(next) => update({ attackType: next as AttackType })}
        />
        <SelectField
          id="dps-style"
          label="Attack style"
          value={draft.style}
          options={toOptions(stylesForClass(draft.combatClass))}
          onChange={(next) => update({ style: next as AttackStyle })}
        />
        <SelectField
          id="dps-void"
          label="Void"
          value={draft.void}
          options={toOptions(voidSetsForClass(draft.combatClass))}
          onChange={(next) => update({ void: next as VoidSet })}
        />

        {draft.combatClass === 'melee' ? (
          <>
            <SelectField
              id="dps-melee-prayer"
              label="Prayer"
              value={draft.meleePrayer}
              options={toOptions(Object.keys(MELEE_PRAYERS))}
              onChange={(next) => update({ meleePrayer: next as MeleePrayer })}
            />
            <SelectField
              id="dps-attack-potion"
              label="Attack potion"
              value={draft.attackPotion}
              options={toOptions(Object.keys(ATTACK_POTIONS))}
              onChange={(next) =>
                update({ attackPotion: next as LoadoutDraft['attackPotion'] })
              }
            />
            <SelectField
              id="dps-strength-potion"
              label="Strength potion"
              value={draft.strengthPotion}
              options={toOptions(Object.keys(STRENGTH_POTIONS))}
              onChange={(next) =>
                update({ strengthPotion: next as LoadoutDraft['strengthPotion'] })
              }
            />
          </>
        ) : null}

        {draft.combatClass === 'ranged' ? (
          <>
            <SelectField
              id="dps-ranged-prayer"
              label="Prayer"
              value={draft.rangedPrayer}
              options={toOptions(Object.keys(RANGED_PRAYERS))}
              onChange={(next) => update({ rangedPrayer: next as RangedPrayer })}
            />
            <SelectField
              id="dps-ranged-potion"
              label="Ranged potion"
              value={draft.rangedPotion}
              options={toOptions(Object.keys(RANGED_POTIONS))}
              onChange={(next) =>
                update({ rangedPotion: next as LoadoutDraft['rangedPotion'] })
              }
            />
          </>
        ) : null}

        {draft.combatClass === 'magic' ? (
          <>
            <SelectField
              id="dps-magic-prayer"
              label="Prayer"
              value={draft.magicPrayer}
              options={toOptions(Object.keys(MAGIC_PRAYERS))}
              onChange={(next) => update({ magicPrayer: next as MagicPrayer })}
              hint="Magic prayers affect accuracy only"
            />
            <SelectField
              id="dps-magic-potion"
              label="Magic potion"
              value={draft.magicPotion}
              options={toOptions(Object.keys(MAGIC_POTIONS))}
              onChange={(next) =>
                update({ magicPotion: next as LoadoutDraft['magicPotion'] })
              }
            />
            <SelectField
              id="dps-magic-source"
              label="Spell or staff"
              value={draft.magicSource}
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
              onChange={(next) => update({ magicSource: next as MagicSourceKey })}
            />
            <NumericField
              mode="number"
              id="dps-extra-magic-damage"
              label="Extra magic damage %"
              value={draft.extraMagicDamagePercent}
              step={0.1}
              onValueChange={(next) => update({ extraMagicDamagePercent: next ?? 0 })}
              hint="Beyond what the gear above supplies"
            />
          </>
        ) : null}
      </fieldset>

      <fieldset className="grid gap-4 rounded-card border border-border p-4 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="px-1 text-2xs font-medium tracking-wide text-content-subtle uppercase">
          Levels
        </legend>
        {(['attack', 'strength', 'ranged', 'magic'] as const).map((skill) => (
          <NumericField
            key={skill}
            mode="number"
            id={`dps-level-${skill}`}
            label={titleCase(skill)}
            value={draft.levels[skill]}
            min={1}
            max={99}
            onValueChange={(next) =>
              update({ levels: { ...draft.levels, [skill]: clampLevel(next) } })
            }
          />
        ))}
      </fieldset>

      <fieldset className="grid gap-4 rounded-card border border-border p-4 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="px-1 text-2xs font-medium tracking-wide text-content-subtle uppercase">
          Equipment
        </legend>
        {LOADOUT_SLOTS.map((slot) => (
          <SelectField
            key={slot}
            id={`dps-gear-${slot}`}
            label={titleCase(slot)}
            value={draft.gear[slot] ?? ''}
            options={[
              { value: '', label: '— none —' },
              ...itemsForSlot(slot).map((item) => ({
                value: item.name,
                label: item.name,
              })),
            ]}
            onChange={(next) => update({ gear: withSlot(draft.gear, slot, next) })}
          />
        ))}
      </fieldset>

      <fieldset className="grid gap-4 rounded-card border border-border p-4 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="px-1 text-2xs font-medium tracking-wide text-content-subtle uppercase">
          Target bonuses
        </legend>
        <SelectField
          id="dps-black-mask"
          label="Black mask"
          value={draft.blackMask}
          options={toOptions(BLACK_MASKS)}
          onChange={(next) => update({ blackMask: next as TargetEffects['blackMask'] })}
        />
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-content">
          <input
            type="checkbox"
            checked={draft.onSlayerTask}
            onChange={(event) => update({ onSlayerTask: event.target.checked })}
            className="size-4 rounded-control border-border"
          />
          On slayer task
        </label>
        <SelectField
          id="dps-salve"
          label="Salve amulet"
          value={draft.salve}
          options={toOptions(SALVES)}
          onChange={(next) => update({ salve: next as TargetEffects['salve'] })}
          hint={
            salveUseless
              ? 'Ignored — this target is not undead'
              : 'Overrides a black mask rather than stacking'
          }
        />
      </fieldset>

      {result ? (
        <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-sunken p-4">
          <div className="flex items-baseline gap-3">
            <span className="text-2xs font-medium tracking-wide text-content-subtle uppercase">
              DPS
            </span>
            <output aria-label="DPS" className="tabular text-4xl font-bold text-content">
              {result.dps.toFixed(3)}
            </output>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatBadge label="Max hit" value={result.maxHit} />
            <StatBadge
              label="Accuracy"
              value={`${(result.accuracy * 100).toFixed(2)}%`}
            />
            <StatBadge label="Attack roll" value={result.attackRoll.toLocaleString()} />
            <StatBadge label="Defence roll" value={result.defenceRoll.toLocaleString()} />
            <StatBadge label="Speed" value={`${result.attackSpeedSeconds.toFixed(1)}s`} />
            <StatBadge
              label="Time to kill"
              value={formatSeconds(result.timeToKillSeconds)}
            />
          </div>
        </div>
      ) : (
        <p className="rounded-card border border-border bg-surface-sunken p-4 text-sm text-content-muted">
          Choose a monster to see DPS.
        </p>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <SelectField
              id="dps-saved-loadouts"
              label="Saved loadouts"
              value=""
              options={[
                { value: '', label: `${saved.length} saved in this browser` },
                ...saved.map((entry, index) => ({
                  value: String(index),
                  label: entry.name,
                })),
              ]}
              onChange={(next) => {
                const entry = saved[Number(next)];
                if (entry) setDraft({ ...entry });
              }}
              hint="Stored in your browser only — there is no sign-in"
            />
          </div>
          <Button
            onClick={() =>
              writeSavedLoadouts([
                ...saved,
                { ...draft, name: draft.name || `Loadout ${saved.length + 1}` },
              ])
            }
          >
            Save for comparison
          </Button>
          <Button
            variant="secondary"
            onClick={() => writeSavedLoadouts([])}
            disabled={saved.length === 0}
          >
            Clear saved
          </Button>
        </div>

        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Loadout</TableHeaderCell>
              <TableHeaderCell numeric>DPS</TableHeaderCell>
              <TableHeaderCell numeric>Max hit</TableHeaderCell>
              <TableHeaderCell numeric>Accuracy</TableHeaderCell>
              <TableHeaderCell numeric>Time to kill</TableHeaderCell>
              <TableHeaderCell numeric>vs best</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {comparison.length === 0 ? (
              <TableEmptyRow colSpan={6}>
                Pick a monster to compare loadouts against it.
              </TableEmptyRow>
            ) : (
              comparison.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{entry.name}</TableCell>
                  <TableCell numeric>{entry.result.dps.toFixed(3)}</TableCell>
                  <TableCell numeric>{entry.result.maxHit}</TableCell>
                  <TableCell numeric>
                    {(entry.result.accuracy * 100).toFixed(2)}%
                  </TableCell>
                  <TableCell numeric>
                    {formatSeconds(entry.result.timeToKillSeconds)}
                  </TableCell>
                  <TableCell numeric>{(entry.relative * 100).toFixed(1)}%</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}

function withSlot(
  gear: LoadoutDraft['gear'],
  slot: EquipmentSlot,
  name: string,
): LoadoutDraft['gear'] {
  const next = { ...gear };
  if (name === '') delete next[slot];
  else next[slot] = name;
  return next;
}

function clampLevel(value: number | null): number {
  if (value === null) return 1;
  return Math.min(99, Math.max(1, Math.floor(value)));
}

function formatSeconds(seconds: number): string {
  if (!Number.isFinite(seconds)) return 'never';
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
