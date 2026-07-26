/**
 * Drop-rate maths.
 *
 * Pure binomial probability — no data source, no formulas to transcribe, no
 * game-update risk. It is here because "1/512 over 400 kills" is the question
 * people actually ask, and the answer is unintuitive enough that most players
 * guess it wrong in the pessimistic direction.
 */

export class DropRateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DropRateError';
  }
}

function assertProbability(p: number): void {
  if (!Number.isFinite(p) || p < 0 || p > 1) {
    throw new DropRateError(`Drop chance must be between 0 and 1, got ${p}.`);
  }
}

function assertKills(kills: number): void {
  if (!Number.isInteger(kills) || kills < 0) {
    throw new DropRateError(`Kill count must be a non-negative integer, got ${kills}.`);
  }
}

/**
 * Probability of **at least one** drop in `kills` attempts.
 *
 * Computed as `1 − (1 − p)^n`, the complement of missing every time. Summing
 * the per-kill probabilities instead — the intuitive wrong answer — exceeds 1
 * once `n > 1/p`, which is precisely where people ask the question.
 */
export function chanceOfAtLeastOne(dropChance: number, kills: number): number {
  assertProbability(dropChance);
  assertKills(kills);
  return 1 - Math.pow(1 - dropChance, kills);
}

/** Probability of exactly `successes` drops in `kills` attempts. */
export function chanceOfExactly(
  dropChance: number,
  kills: number,
  successes: number,
): number {
  assertProbability(dropChance);
  assertKills(kills);
  assertKills(successes);
  if (successes > kills) return 0;

  // Computed in log space. The naive form multiplies a binomial coefficient
  // (astronomically large at 10,000 kills) by a probability that has already
  // underflowed to zero, and returns NaN.
  const logP =
    logBinomialCoefficient(kills, successes) +
    successes * Math.log(dropChance) +
    (kills - successes) * Math.log1p(-dropChance);

  return Math.exp(logP);
}

/** Probability of at least `successes` drops in `kills` attempts. */
export function chanceOfAtLeast(
  dropChance: number,
  kills: number,
  successes: number,
): number {
  assertProbability(dropChance);
  assertKills(kills);
  assertKills(successes);
  if (successes === 0) return 1;
  if (successes > kills) return 0;

  // Sum the short tail. Summing from 0 to successes-1 and subtracting is fewer
  // terms when the target is high, and avoids accumulating error over 10,000
  // vanishingly small terms.
  let below = 0;
  for (let k = 0; k < successes; k += 1) below += chanceOfExactly(dropChance, kills, k);
  return Math.max(0, 1 - below);
}

/**
 * Kills needed for a `confidence` chance of at least one drop.
 *
 * The answer to "how dry can I get?" — at 1/512, a 99% chance takes 2,357
 * kills, roughly 4.6× the drop rate. Returns a whole number of kills.
 */
export function killsForConfidence(dropChance: number, confidence: number): number {
  assertProbability(dropChance);
  assertProbability(confidence);
  if (dropChance === 0) return Infinity;
  if (confidence === 0) return 0;
  if (confidence === 1) return Infinity;

  return Math.ceil(Math.log1p(-confidence) / Math.log1p(-dropChance));
}

/** Expected number of drops in `kills` attempts. */
export function expectedDrops(dropChance: number, kills: number): number {
  assertProbability(dropChance);
  assertKills(kills);
  return dropChance * kills;
}

/** `log(n choose k)`, via log-gamma, so large `n` does not overflow. */
function logBinomialCoefficient(n: number, k: number): number {
  return logFactorial(n) - logFactorial(k) - logFactorial(n - k);
}

/** Exact for the small values a kill count reaches; Stirling-free. */
function logFactorial(n: number): number {
  let total = 0;
  for (let i = 2; i <= n; i += 1) total += Math.log(i);
  return total;
}
