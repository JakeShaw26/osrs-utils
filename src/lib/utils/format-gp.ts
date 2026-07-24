/**
 * Formats a GP amount the way the game does: 1_400_000_000 -> "1.4b".
 *
 * Lives in lib/, not in the component that renders it, because it is pure logic
 * and must be unit-testable without rendering anything. Every OSRS money value
 * in the app goes through here so that "2.1m" never appears as "2.10m" on one
 * screen and "2,100,000" on another. (PRD §6.2)
 *
 * bigint because high-value stacks and total clan GP overflow Number.MAX_SAFE_INTEGER.
 */
export function formatGp(amount: bigint | number): string {
  const value = typeof amount === 'bigint' ? amount : BigInt(Math.round(amount));
  const negative = value < 0n;
  const abs = negative ? -value : value;

  const format = (divisor: bigint, suffix: string): string => {
    const whole = abs / divisor;
    const remainder = ((abs % divisor) * 10n) / divisor;
    const text = remainder === 0n ? `${whole}` : `${whole}.${remainder}`;
    return `${text}${suffix}`;
  };

  let text: string;
  if (abs >= 1_000_000_000n) text = format(1_000_000_000n, 'b');
  else if (abs >= 1_000_000n) text = format(1_000_000n, 'm');
  else if (abs >= 1_000n) text = format(1_000n, 'k');
  else text = abs.toString();

  return negative ? `-${text}` : text;
}

/** Full precision with separators, for tooltips and inputs. */
export function formatGpExact(amount: bigint | number): string {
  return (
    typeof amount === 'bigint' ? amount : BigInt(Math.round(amount))
  ).toLocaleString('en-GB');
}
