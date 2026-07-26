import { describe, expect, it } from 'vitest';
import {
  MAGIC_POTIONS,
  RANGED_POTIONS,
  STRENGTH_POTIONS,
  potionBoost,
} from './constants';
import {
  dharoksMultiplier,
  effectiveMagicAttack,
  effectiveMeleeAttack,
  effectiveRangedAttack,
  magicMaxHit,
  meleeMaxHit,
  poweredStaffMaxHit,
  rangedMaxHit,
  type MeleeMaxHitInput,
  type RangedMaxHitInput,
} from './max-hit';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  GOLDEN-FILE TESTS — read this before changing an expected value
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A failure here means the engine's answer moved. That is a defect until proven
 * otherwise; re-baselining is the one response that is always wrong. If a game
 * update genuinely changed a formula, update the *formula*, cite the new wiki
 * revision, and change the expectation in the same commit.
 *
 * Where each expected value comes from — three tiers, labelled per test:
 *
 *   [PUBLISHED]  The wiki states this outcome in prose for a named setup. The
 *                strongest anchor available to us: it exercises the whole
 *                chain and was produced by someone else. There is only one, and
 *                it is worth more than the rest combined.
 *
 *   [GAME FACT]  A universally-known property of the game that pins a specific
 *                term in a formula (e.g. a level-1 account can deal damage,
 *                which is only true if the `+320` rounding term exists).
 *
 *   [DERIVED]    Hand-worked from the cited wiki formula, with the full
 *                arithmetic written out in the comment so a reviewer can check
 *                it with a calculator and never has to trust the code.
 *
 * ⚠️ Honest limitation: we could not drive the official Wiki DPS calculator to
 * harvest reference numbers — it is a client-side GPL application, and reading
 * its source to obtain values is exactly what ADR-0007 forbids. So [DERIVED]
 * cases verify that the code implements the documented formula, not that the
 * documented formula matches the game. The [PUBLISHED] case is what connects
 * the two. Recorded as a known risk in ADR-0015.
 *
 * Formula sources are named per-test; the page list is in `constants.ts`.
 */

const MAXED: Omit<MeleeMaxHitInput, 'strengthBonus'> = {
  strengthLevel: 99,
  strengthBoost: 0,
  prayer: 'none',
  style: 'aggressive',
  void: 'none',
};

describe('meleeMaxHit', () => {
  /**
   * [PUBLISHED] — OSRS Wiki, "Maximum melee hit":
   *   "For free-to-play the maximum hit is 31, using a rune 2h sword, an
   *    amulet of strength, decorative boots (gold), and a strength potion with
   *    Ultimate Strength active."
   *
   * Equipment strength bonuses from the Bucket `infobox_bonuses` rows committed
   * in `data/equipment.generated.ts`:
   *   Rune 2h sword +70, Amulet of strength +10, Decorative boots (gold) +1 = 81
   *
   * Worked through:
   *   Strength potion boost = ⌊99 × 0.10⌋ + 3            = 12   → visible 111
   *   ⌊111 × 1.15⌋                                       = 127         (Ultimate Strength)
   *   127 + 3 (Aggressive) + 8                           = 138         (effective strength)
   *   ⌊(138 × (81 + 64) + 320) / 640⌋ = ⌊20330 / 640⌋    = 31
   *
   * THIS TEST IS THE REASON THE ENGINE ORDERS PRAYER BEFORE THE STYLE BONUS.
   * The "Maximum melee hit" page writes the effective-strength step as
   * ⌊(level + style + 8) × prayer⌋, which yields ⌊122 × 1.15⌋ = 140 → 32, and
   * contradicts the same wiki's own published answer of 31. The DPS pages'
   * ordering — prayer on the boosted level alone — reproduces 31 exactly. When
   * two documented orderings disagree, the published outcome decides.
   */
  it('[PUBLISHED] reproduces the wiki-stated free-to-play maximum hit of 31', () => {
    const result = meleeMaxHit({
      strengthLevel: 99,
      strengthBoost: potionBoost(99, STRENGTH_POTIONS['Strength potion']),
      prayer: 'Ultimate Strength',
      style: 'aggressive',
      strengthBonus: 70 + 10 + 1,
      void: 'none',
    });

    expect(result.effectiveLevel).toBe(138);
    expect(result.maxHit).toBe(31);
  });

  /**
   * [GAME FACT] — a brand-new account punching with no equipment deals damage.
   *
   * ⌊1 × 1⌋ + 0 (Accurate gives melee no *strength* bonus) + 8 = 9
   * ⌊(9 × (0 + 64) + 320) / 640⌋ = ⌊896 / 640⌋ = 1
   *
   * Drop the `+ 320` and this returns 0 — a level-3 account that can never deal
   * damage. That term is the wiki's `0.5 +` written as integer arithmetic, and
   * this is the cheapest test that proves it is present.
   */
  it('[GAME FACT] a level-1 unarmed player still has a maximum hit of 1', () => {
    const result = meleeMaxHit({
      strengthLevel: 1,
      strengthBoost: 0,
      prayer: 'none',
      style: 'accurate',
      strengthBonus: 0,
      void: 'none',
    });

    expect(result.maxHit).toBe(1);
  });

  /**
   * [DERIVED] — Damage per second/Melee, effective strength step.
   *   ⌊99 × 1.23⌋ = 121;  121 + 3 + 8 = 132
   *   ⌊(132 × 64 + 320) / 640⌋ = ⌊8768 / 640⌋ = 13
   * The rejected ordering gives ⌊110 × 1.23⌋ = 135 → ⌊8960 / 640⌋ = 14, so this
   * case fails loudly if the two lines are ever swapped back.
   */
  it('[DERIVED] applies the prayer multiplier to the level, not to level+style+8', () => {
    const result = meleeMaxHit({ ...MAXED, prayer: 'Piety', strengthBonus: 0 });

    expect(result.effectiveLevel).toBe(132);
    expect(result.maxHit).toBe(13);
  });

  /**
   * [DERIVED] — Maximum melee hit, Void step. Void multiplies **last**, after
   * the style bonus and the +8 are already in:
   *   ⌊(99 + 3 + 8) × 1.1⌋ = ⌊121⌋ = 121
   *   ⌊(121 × 64 + 320) / 640⌋ = ⌊8064 / 640⌋ = 12
   * Multiplying the level first would give ⌊⌊108.9⌋ + 11⌋ = 119 → 12 as well
   * here, so the assertion is on the effective level, where they differ.
   */
  it('[DERIVED] applies Void after the style bonus and the +8', () => {
    const result = meleeMaxHit({ ...MAXED, void: 'melee', strengthBonus: 0 });

    expect(result.effectiveLevel).toBe(121);
    expect(result.maxHit).toBe(12);
  });

  /**
   * [DERIVED] — potion boost is added to the level *before* the prayer
   * multiplier, so the two compound. Super strength at 99 is ⌊99 × 0.15⌋ + 5 =
   * 19, giving a visible 118.
   *   ⌊118 × 1.23⌋ = 145;  145 + 3 + 8 = 156
   *   ⌊(156 × 64 + 320) / 640⌋ = ⌊10304 / 640⌋ = 16
   */
  it('[DERIVED] stacks potion then prayer, in that order', () => {
    const boost = potionBoost(99, STRENGTH_POTIONS['Super strength']);
    expect(boost).toBe(19);

    const result = meleeMaxHit({
      ...MAXED,
      strengthBoost: boost,
      prayer: 'Piety',
      strengthBonus: 0,
    });

    expect(result.effectiveLevel).toBe(156);
    expect(result.maxHit).toBe(16);
  });

  /**
   * [DERIVED] — Maximum melee hit, "Special attack/effect bonuses":
   * black mask / slayer helm is 7/6 on task. Base 31 → ⌊31 × 7/6⌋ = ⌊36.16⌋ = 36.
   */
  it('[DERIVED] applies the 7/6 black mask multiplier on task', () => {
    const base = { ...MAXED, strengthBonus: 118 } satisfies MeleeMaxHitInput;
    const off = meleeMaxHit(base);
    const on = meleeMaxHit({
      ...base,
      target: { blackMask: 'black mask', onSlayerTask: true, salve: 'none' },
    });

    expect(off.maxHit).toBe(31);
    expect(on.maxHit).toBe(36);
  });

  it('[DERIVED] ignores a black mask when not on task', () => {
    const result = meleeMaxHit({
      ...MAXED,
      strengthBonus: 118,
      target: { blackMask: 'black mask', onSlayerTask: false, salve: 'none' },
    });

    expect(result.maxHit).toBe(31);
  });

  /**
   * The salve amulet and the black mask do not stack; the salve takes priority.
   * Multiplying both would give ⌊⌊31 × 1.2⌋ × 7/6⌋ = 43 instead of 37 — a 16%
   * overstatement on every undead slayer task, which is exactly the kind of
   * plausible-looking wrong answer this engine exists to avoid.
   */
  it('[DERIVED] lets the salve amulet override the black mask rather than stacking', () => {
    const both = meleeMaxHit({
      ...MAXED,
      strengthBonus: 118,
      target: { blackMask: 'black mask', onSlayerTask: true, salve: 'salve amulet (e)' },
    });
    const salveOnly = meleeMaxHit({
      ...MAXED,
      strengthBonus: 118,
      target: { blackMask: 'none', onSlayerTask: false, salve: 'salve amulet (e)' },
    });

    expect(both.maxHit).toBe(salveOnly.maxHit);
    expect(both.maxHit).toBe(37); // ⌊31 × 1.2⌋
  });

  /**
   * [DERIVED] — Maximum melee hit, Dharok's passive:
   *   1 + (maxHP − curHP)/100 × maxHP/100
   * At 99/99 that is exactly 1 (no bonus at full health); at 1/99 it is
   * 1 + 0.98 × 0.99 = 1.9702, so base 31 → ⌊61.07⌋ = 61.
   */
  it('[DERIVED] scales Dharok damage with missing hitpoints', () => {
    expect(dharoksMultiplier(99, 99)).toBe(1);
    expect(dharoksMultiplier(99, 1)).toBeCloseTo(1.9702, 6);

    const full = meleeMaxHit({
      ...MAXED,
      strengthBonus: 118,
      dharoks: { maxHitpoints: 99, currentHitpoints: 99 },
    });
    const nearlyDead = meleeMaxHit({
      ...MAXED,
      strengthBonus: 118,
      dharoks: { maxHitpoints: 99, currentHitpoints: 1 },
    });

    expect(full.maxHit).toBe(31);
    expect(nearlyDead.maxHit).toBe(61);
  });

  /** Overhealed above the maximum must not reduce damage below the base. */
  it('[DERIVED] treats being overhealed as no Dharok bonus rather than a penalty', () => {
    expect(dharoksMultiplier(99, 120)).toBe(1);
  });

  /**
   * [GAME FACT] — Jagex caps all damage at 200 as an anti-exploit guardrail
   * (Maximum melee hit, citing the 29 October 2025 newspost).
   */
  it('[GAME FACT] caps damage at 200', () => {
    const result = meleeMaxHit({
      ...MAXED,
      strengthLevel: 99,
      strengthBonus: 118,
      dharoks: { maxHitpoints: 500, currentHitpoints: 1 },
    });

    expect(result.maxHit).toBe(200);
  });

  /**
   * [DERIVED] — negative strength bonuses are real (a magic staff is −1 or
   * worse) and must not be clamped away.
   *   effective 110 with bonus −20: ⌊(110 × 44 + 320) / 640⌋ = ⌊5160 / 640⌋ = 8
   */
  it('[DERIVED] handles a negative strength bonus', () => {
    const result = meleeMaxHit({ ...MAXED, strengthBonus: -20 });

    expect(result.effectiveLevel).toBe(110);
    expect(result.maxHit).toBe(8);
  });

  it('[DERIVED] gives Accurate no strength bonus and Aggressive no accuracy bonus', () => {
    const accurate = meleeMaxHit({ ...MAXED, style: 'accurate', strengthBonus: 0 });
    const aggressive = meleeMaxHit({ ...MAXED, style: 'aggressive', strengthBonus: 0 });

    expect(accurate.effectiveLevel).toBe(107); // 99 + 0 + 8
    expect(aggressive.effectiveLevel).toBe(110); // 99 + 3 + 8

    expect(
      effectiveMeleeAttack({
        level: 99,
        boost: 0,
        prayer: 'none',
        style: 'accurate',
        void: 'none',
      }),
    ).toBe(110);
    expect(
      effectiveMeleeAttack({
        level: 99,
        boost: 0,
        prayer: 'none',
        style: 'aggressive',
        void: 'none',
      }),
    ).toBe(107);
  });

  it('[DERIVED] gives Controlled +1 to both rolls', () => {
    expect(
      meleeMaxHit({ ...MAXED, style: 'controlled', strengthBonus: 0 }).effectiveLevel,
    ).toBe(108);
    expect(
      effectiveMeleeAttack({
        level: 99,
        boost: 0,
        prayer: 'none',
        style: 'controlled',
        void: 'none',
      }),
    ).toBe(108);
  });
});

describe('rangedMaxHit', () => {
  const RANGED: Omit<RangedMaxHitInput, 'rangedStrengthBonus'> = {
    rangedLevel: 99,
    rangedBoost: 0,
    prayer: 'none',
    style: 'rapid',
    void: 'none',
  };

  /**
   * [DERIVED] — Maximum ranged hit / Damage per second/Ranged.
   * Rigour is the asymmetric one: +20% accuracy but +23% damage. Getting a
   * single multiplier for both is the most likely ranged bug, so it is asserted
   * on both sides.
   *   damage:   ⌊99 × 1.23⌋ = 121;  121 + 0 + 8 = 129
   *   accuracy: ⌊99 × 1.20⌋ = 118;  118 + 0 + 8 = 126
   */
  it('[DERIVED] uses 1.23 for Rigour damage but 1.20 for Rigour accuracy', () => {
    const damage = rangedMaxHit({ ...RANGED, prayer: 'Rigour', rangedStrengthBonus: 0 });
    const accuracy = effectiveRangedAttack({
      level: 99,
      boost: 0,
      prayer: 'Rigour',
      style: 'rapid',
      void: 'none',
    });

    expect(damage.effectiveLevel).toBe(129);
    expect(accuracy).toBe(126);
  });

  /**
   * [DERIVED] — unlike melee, ranged Accurate adds +3 to *both* rolls. Copying
   * the melee style table across is the second most likely ranged bug.
   */
  it('[DERIVED] gives ranged Accurate +3 to damage as well as accuracy', () => {
    const damage = rangedMaxHit({ ...RANGED, style: 'accurate', rangedStrengthBonus: 0 });
    const accuracy = effectiveRangedAttack({
      level: 99,
      boost: 0,
      prayer: 'none',
      style: 'accurate',
      void: 'none',
    });

    expect(damage.effectiveLevel).toBe(110);
    expect(accuracy).toBe(110);
  });

  /**
   * [DERIVED] — elite void ranged is 1.125 on damage but only 1.1 on accuracy.
   *   damage:   ⌊(99 + 0 + 8) × 1.125⌋ = ⌊120.375⌋ = 120
   *   accuracy: ⌊(99 + 0 + 8) × 1.1⌋   = ⌊117.7⌋   = 117
   */
  it('[DERIVED] distinguishes elite void ranged damage from its accuracy', () => {
    const damage = rangedMaxHit({
      ...RANGED,
      void: 'elite ranged',
      rangedStrengthBonus: 0,
    });
    const accuracy = effectiveRangedAttack({
      level: 99,
      boost: 0,
      prayer: 'none',
      style: 'rapid',
      void: 'elite ranged',
    });

    expect(damage.effectiveLevel).toBe(120);
    expect(accuracy).toBe(117);
  });

  /**
   * [DERIVED] — a Twisted bow with dragon arrows, 99 Ranged, Rigour, Rapid.
   * Ranged strength bonuses from the committed Bucket data: bow +20, arrow +60.
   *   ⌊99 × 1.23⌋ = 121;  121 + 0 + 8 = 129
   *   ⌊(129 × (80 + 64) + 320) / 640⌋ = ⌊18896 / 640⌋ = 29
   *
   * ⚠️ The Twisted bow's own damage scaling against high-Magic targets is NOT
   * modelled — this is the bow's *baseline* max hit. See ADR-0015.
   */
  it('[DERIVED] computes a Twisted bow + dragon arrow baseline maximum hit', () => {
    const result = rangedMaxHit({
      ...RANGED,
      prayer: 'Rigour',
      rangedStrengthBonus: 20 + 60,
    });

    expect(result.maxHit).toBe(29);
  });

  it('[DERIVED] applies the imbued black mask at 1.15 for ranged, not 7/6', () => {
    const base = rangedMaxHit({ ...RANGED, prayer: 'Rigour', rangedStrengthBonus: 80 });
    const onTask = rangedMaxHit({
      ...RANGED,
      prayer: 'Rigour',
      rangedStrengthBonus: 80,
      target: { blackMask: 'black mask (i)', onSlayerTask: true, salve: 'none' },
    });

    expect(base.maxHit).toBe(29);
    expect(onTask.maxHit).toBe(33); // ⌊29 × 1.15⌋ = ⌊33.35⌋
  });

  it('[DERIVED] gives an un-imbued black mask no ranged bonus', () => {
    const result = rangedMaxHit({
      ...RANGED,
      prayer: 'Rigour',
      rangedStrengthBonus: 80,
      target: { blackMask: 'black mask', onSlayerTask: true, salve: 'none' },
    });

    expect(result.maxHit).toBe(29);
  });

  it('[DERIVED] applies the ranging potion boost of ⌊level × 0.1⌋ + 4', () => {
    expect(potionBoost(99, RANGED_POTIONS['Ranging potion'])).toBe(13);
  });
});

describe('magicMaxHit', () => {
  /**
   * [GAME FACT] — the standard spellbook's base maximum hits are fixed numbers
   * published in a table; Fire surge is 24 and does not scale with level.
   */
  it('[GAME FACT] uses the spell’s fixed base maximum hit', () => {
    const result = magicMaxHit({
      magicLevel: 99,
      magicBoost: 0,
      source: { kind: 'spell', spell: 'Fire surge' },
      magicDamagePercent: 0,
    });

    expect(result.maxHit).toBe(24);
  });

  /**
   * [DERIVED] — Maximum magic hit: gear magic damage is summed additively and
   * applied as one multiplier. ⌊24 × 1.25⌋ = 30.
   */
  it('[DERIVED] applies summed magic damage as a single additive percentage', () => {
    const result = magicMaxHit({
      magicLevel: 99,
      magicBoost: 0,
      source: { kind: 'spell', spell: 'Fire surge' },
      magicDamagePercent: 25,
    });

    expect(result.maxHit).toBe(30);
  });

  /**
   * [DERIVED] — powered staff formulas, from the wiki's own powered-staff
   * calculator template: ⌊level / 3 + offset⌋ on the **visible** Magic level.
   *   Tumeken's shadow   ⌊99/3 + 1⌋ = 34
   *   Sanguinesti staff  ⌊99/3 − 1⌋ = 32
   *   Trident of the swamp ⌊99/3 − 2⌋ = 31
   *   Trident of the seas  ⌊99/3 − 5⌋ = 28
   */
  it('[DERIVED] computes powered staff maximum hits at 99 Magic', () => {
    expect(poweredStaffMaxHit("Tumeken's shadow", 99)).toBe(34);
    expect(poweredStaffMaxHit('Sanguinesti staff', 99)).toBe(32);
    expect(poweredStaffMaxHit('Trident of the swamp', 99)).toBe(31);
    expect(poweredStaffMaxHit('Trident of the seas', 99)).toBe(28);
  });

  /**
   * A powered staff reads the *visible* level, so a boost raises its base hit —
   * unlike a standard spell, which a Magic boost cannot improve at all. Getting
   * this backwards is a silent, plausible-looking error.
   *   99 + (⌊99 × 0.1⌋ + 4) = 112;  ⌊112 / 3 + 1⌋ = ⌊38.33⌋ = 38
   */
  it('[DERIVED] scales a powered staff with the boosted level but a spell not at all', () => {
    const boost = potionBoost(99, MAGIC_POTIONS['Saturated heart']);
    expect(boost).toBe(13);

    const staff = magicMaxHit({
      magicLevel: 99,
      magicBoost: boost,
      source: { kind: 'powered staff', staff: "Tumeken's shadow" },
      magicDamagePercent: 0,
    });
    const spell = magicMaxHit({
      magicLevel: 99,
      magicBoost: boost,
      source: { kind: 'spell', spell: 'Fire surge' },
      magicDamagePercent: 0,
    });

    expect(staff.maxHit).toBe(38);
    expect(spell.maxHit).toBe(24);
  });

  /** A low-level trident would otherwise produce a negative maximum hit. */
  it('[DERIVED] floors a powered staff maximum hit at zero for low levels', () => {
    expect(poweredStaffMaxHit('Trident of the seas', 5)).toBe(0);
  });

  /**
   * [DERIVED] — Damage per second/Magic: magic void is a 1.45 **accuracy**
   * multiplier and contributes no damage.
   *   ⌊⌊99 × 1⌋ × 1.45 + 0 + 8⌋ = ⌊143.55 + 8⌋ = 151
   */
  it('[DERIVED] applies magic void to accuracy only', () => {
    const accuracy = effectiveMagicAttack({
      level: 99,
      boost: 0,
      prayer: 'none',
      style: 'accurate',
      void: 'magic',
      poweredStaff: false,
    });

    expect(accuracy).toBe(151);

    const damage = magicMaxHit({
      magicLevel: 99,
      magicBoost: 0,
      source: { kind: 'spell', spell: 'Fire surge' },
      magicDamagePercent: 0,
    });
    expect(damage.maxHit).toBe(24);
  });

  /**
   * [DERIVED] — the magic style bonus applies to powered staves only. A
   * standard-spellbook cast gets nothing regardless of the stance shown.
   */
  it('[DERIVED] gives a standard spell no style accuracy bonus', () => {
    const spell = effectiveMagicAttack({
      level: 99,
      boost: 0,
      prayer: 'none',
      style: 'accurate',
      void: 'none',
      poweredStaff: false,
    });
    const staff = effectiveMagicAttack({
      level: 99,
      boost: 0,
      prayer: 'none',
      style: 'accurate',
      void: 'none',
      poweredStaff: true,
    });

    expect(spell).toBe(107); // 99 + 8
    expect(staff).toBe(110); // 99 + 3 + 8
  });

  it('[DERIVED] applies the magic salve at 1.15, not the melee 7/6', () => {
    const result = magicMaxHit({
      magicLevel: 99,
      magicBoost: 0,
      source: { kind: 'spell', spell: 'Fire surge' },
      magicDamagePercent: 0,
      target: { blackMask: 'none', onSlayerTask: false, salve: 'salve amulet (i)' },
    });

    expect(result.maxHit).toBe(27); // ⌊24 × 1.15⌋ = ⌊27.6⌋
  });
});

describe('boundaries', () => {
  it('handles level 1 across all three classes without producing NaN', () => {
    const melee = meleeMaxHit({
      strengthLevel: 1,
      strengthBoost: 0,
      prayer: 'none',
      style: 'aggressive',
      strengthBonus: 0,
      void: 'none',
    });
    const ranged = rangedMaxHit({
      rangedLevel: 1,
      rangedBoost: 0,
      prayer: 'none',
      style: 'rapid',
      rangedStrengthBonus: 0,
      void: 'none',
    });
    const magic = magicMaxHit({
      magicLevel: 1,
      magicBoost: 0,
      source: { kind: 'spell', spell: 'Wind strike' },
      magicDamagePercent: 0,
    });

    expect(melee.maxHit).toBe(1);
    expect(ranged.maxHit).toBe(1);
    expect(magic.maxHit).toBe(2);
  });

  it('rounds the potion boost percentage before adding the flat part', () => {
    // ⌊1 × 0.15⌋ + 5 = 5, not ⌊1 × 0.15 + 5⌋ = 5 — identical here, but at 99
    // the two differ: ⌊14.85⌋ + 5 = 19 vs ⌊19.85⌋ = 19. The distinguishing
    // case is a level where the fractional parts cross an integer.
    expect(potionBoost(1, STRENGTH_POTIONS['Super strength'])).toBe(5);
    expect(potionBoost(70, STRENGTH_POTIONS['Super strength'])).toBe(15); // ⌊10.5⌋ + 5
    expect(potionBoost(99, STRENGTH_POTIONS['Strength potion'])).toBe(12); // ⌊9.9⌋ + 3
  });

  it('treats a zero equipment bonus as valid rather than absent', () => {
    const result = meleeMaxHit({ ...MAXED, strengthBonus: 0 });

    expect(result.maxHit).toBe(11); // ⌊(110 × 64 + 320) / 640⌋ = ⌊7360 / 640⌋
  });
});
