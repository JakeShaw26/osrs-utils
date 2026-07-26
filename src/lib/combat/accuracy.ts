import type { AttackType, MonsterStats } from './types';

/**
 * The accuracy half of the engine: two rolls and a comparison.
 *
 * Both sides roll a uniform number up to their own maximum; the attacker hits
 * when the attack roll beats the defence roll. The closed form below is the
 * probability of that, and it is asymmetric because ties go to the defender —
 * which is why there are two branches rather than one expression.
 *
 * Source: OSRS Wiki, Damage per second/{Melee,Ranged,Magic}, read 2026-07-26.
 */

/**
 * ⌊ effective attack × (equipment attack bonus + 64) × gear multiplier ⌋
 *
 * The gear multiplier (black mask on task, salve on undead) belongs *inside*
 * the floor, applied to the whole product rather than to the effective level.
 */
export function maxAttackRoll(
  effectiveAttack: number,
  equipmentAttackBonus: number,
  gearMultiplier = 1,
): number {
  return Math.floor(effectiveAttack * (equipmentAttackBonus + 64) * gearMultiplier);
}

/**
 * (defence level + 9) × (style defence bonus + 64)
 *
 * Note the +9, not the +8 that the player side uses, and note that a monster
 * gets no style bonus. These are genuinely different formulas that look like
 * the same one.
 */
export function monsterDefenceRoll(
  monster: MonsterStats,
  attackType: AttackType,
): number {
  const bonus = monsterDefenceBonus(monster, attackType);
  const level = attackType === 'magic' ? monster.magic : monster.defence;
  return (level + 9) * (bonus + 64);
}

/**
 * Magic accuracy rolls against the monster's **Magic level**, not its Defence
 * level — which is why Zulrah's magic-defence form is so much harder to hit
 * with spells than its Defence stat suggests.
 */
export function monsterDefenceBonus(
  monster: MonsterStats,
  attackType: AttackType,
): number {
  switch (attackType) {
    case 'stab':
      return monster.stabDefence;
    case 'slash':
      return monster.slashDefence;
    case 'crush':
      return monster.crushDefence;
    case 'ranged':
      return monster.rangedDefence;
    case 'magic':
      return monster.magicDefence;
  }
}

/**
 * Probability that an attack lands, in [0, 1].
 *
 * The two branches are not a rounding convenience — they are the exact
 * probability of `attackRoll > defenceRoll` under the game's two uniform draws,
 * and they meet continuously where the rolls are equal.
 */
export function hitChance(attackRoll: number, defenceRoll: number): number {
  if (attackRoll > defenceRoll) {
    return 1 - (defenceRoll + 2) / (2 * (attackRoll + 1));
  }
  return attackRoll / (2 * (defenceRoll + 1));
}
