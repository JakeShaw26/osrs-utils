/**
 * Shared vocabulary for the combat engine.
 *
 * Nothing in `src/lib/combat/` touches the network, the database or React — the
 * whole engine is pure functions over these types, which is what makes the
 * golden tests possible (docs/testing.md, ADR-0015).
 */

export type CombatClass = 'melee' | 'ranged' | 'magic';

/** The five defence stats a monster has, and the five rolls we can make. */
export type AttackType = 'stab' | 'slash' | 'crush' | 'ranged' | 'magic';

/**
 * Attack styles, named as the game names them.
 *
 * `aggressive` and `controlled` are melee-only; `rapid` and `longrange` are
 * ranged-only. The engine reads the style twice — once for the accuracy bonus
 * and once for the damage bonus — and the two tables do not agree, which is the
 * single most common place a hand-rolled calculator goes wrong.
 */
export type AttackStyle =
  'accurate' | 'aggressive' | 'controlled' | 'defensive' | 'rapid' | 'longrange';

export type EquipmentSlot =
  | 'head'
  | 'cape'
  | 'neck'
  | 'ammo'
  | 'weapon'
  | '2h'
  | 'body'
  | 'shield'
  | 'legs'
  | 'hands'
  | 'feet'
  | 'ring';

/** A player's visible combat levels, before any potion. */
export interface CombatLevels {
  attack: number;
  strength: number;
  defence: number;
  ranged: number;
  magic: number;
  hitpoints: number;
}

/** One row of `infobox_bonuses`, narrowed to what the engine uses. */
export interface EquipmentItem {
  /** `page_name` — the wiki page, and the only key that joins buckets. */
  name: string;
  slot: EquipmentSlot | null;
  /** e.g. `Whip`, `Bow`, `Powered Staff`. Null for non-weapons. */
  weaponCategory: string | null;
  /** Ticks. Null for non-weapons. */
  attackSpeed: number | null;
  stab: number;
  slash: number;
  crush: number;
  ranged: number;
  magic: number;
  strength: number;
  rangedStrength: number;
  /** Percentage points, e.g. `5` for +5% magic damage. */
  magicDamage: number;
  prayer: number;
}

/** The summed bonuses of a worn set — what the formulas actually consume. */
export interface EquipmentBonuses {
  stab: number;
  slash: number;
  crush: number;
  ranged: number;
  magic: number;
  strength: number;
  rangedStrength: number;
  magicDamage: number;
  prayer: number;
}

/** One row of `infobox_monster`, narrowed to what the engine uses. */
export interface MonsterStats {
  name: string;
  /**
   * `version_anchor`. Multi-form monsters are several rows — Zulrah is three
   * with different magic defences — so name alone does not identify a fight.
   */
  version: string;
  combatLevel: number;
  hitpoints: number;
  attack: number;
  strength: number;
  defence: number;
  magic: number;
  ranged: number;
  stabDefence: number;
  slashDefence: number;
  crushDefence: number;
  magicDefence: number;
  rangedDefence: number;
  size: number;
  /** e.g. `undead`, `demon`, `dragon`. Drives salve amulet eligibility. */
  attributes: readonly string[];
  slayerCategories: readonly string[];
}
