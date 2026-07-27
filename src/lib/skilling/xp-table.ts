/**
 * The OSRS experience table — 99 entries, index 0 = level 1.
 *
 * There is no API for this. It is a fixed constant of the game, so it is
 * authored here rather than fetched (PRD §3.3).
 *
 * WHY A LITERAL RATHER THAN A COMPUTED TABLE
 *
 * The published formula is
 *
 *     xp(L) = floor( (1/4) * sum(n = 1 .. L-1) floor(n + 300 * 2^(n/7)) )
 *
 * and computing it at runtime would work. It is written out instead because a
 * table of literals is reviewable in a diff and cannot drift with a change of
 * floating-point behaviour, and because every value here is read on nearly
 * every render of the XP calculator.
 *
 * The safety net is `xp-table.test.ts`, which recomputes the whole table from
 * the formula above and requires it to match entry for entry. A typo in either
 * encoding fails the build, so neither is trusted alone.
 *
 * Values cross-checked against the OSRS Wiki "Experience" article
 * (retrieved 2026-07-26) at levels 2, 50, 92, 98 and 99.
 */
export const XP_TABLE: readonly number[] = Object.freeze([
  0, 83, 174, 276, 388, 512, 650, 801, 969, 1_154, 1_358, 1_584, 1_833, 2_107, 2_411,
  2_746, 3_115, 3_523, 3_973, 4_470, 5_018, 5_624, 6_291, 7_028, 7_842, 8_740, 9_730,
  10_824, 12_031, 13_363, 14_833, 16_456, 18_247, 20_224, 22_406, 24_815, 27_473, 30_408,
  33_648, 37_224, 41_171, 45_529, 50_339, 55_649, 61_512, 67_983, 75_127, 83_014, 91_721,
  101_333, 111_945, 123_660, 136_594, 150_872, 166_636, 184_040, 203_254, 224_466,
  247_886, 273_742, 302_288, 333_804, 368_599, 407_015, 449_428, 496_254, 547_953,
  605_032, 668_051, 737_627, 814_445, 899_257, 992_895, 1_096_278, 1_210_421, 1_336_443,
  1_475_581, 1_629_200, 1_798_808, 1_986_068, 2_192_818, 2_421_087, 2_673_114, 2_951_373,
  3_258_594, 3_597_792, 3_972_294, 4_385_776, 4_842_295, 5_346_332, 5_902_831, 6_517_253,
  7_195_629, 7_944_614, 8_771_558, 9_684_577, 10_692_629, 11_805_606, 13_034_431,
]);

/** The lowest level any skill can be. Hitpoints starts at 10, but 1 is the floor. */
export const MIN_LEVEL = 1;

/** Level 99 is the cap for every skill in OSRS. */
export const MAX_LEVEL = 99;

/** XP at level 99. Reaching this is "maxed", but it is NOT the XP ceiling. */
export const XP_AT_MAX_LEVEL = 13_034_431;

/**
 * The hard XP ceiling per skill.
 *
 * The distinction from `XP_AT_MAX_LEVEL` is the one this calculator gets asked
 * about most: a player with 50m Slayer is level 99 and has 37m XP still to
 * gain before the counter stops. Treating 13,034,431 as "the end" would tell
 * every 99 that there is nothing left to train, which is wrong.
 *
 * The cap exists because XP is stored as a fixed-point 32-bit value; past it,
 * actions still work but award nothing. (OSRS Wiki "Experience", 2026-07-26)
 */
export const MAX_XP = 200_000_000;
