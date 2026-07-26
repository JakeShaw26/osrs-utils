import { describe, expect, it } from 'vitest';
import { assessLiquidity, calculateFlip, LIQUIDITY_THRESHOLDS } from './flipping';

describe('calculateFlip', () => {
  it('subtracts tax from the gross margin', () => {
    const flip = calculateFlip({ buyPrice: 1_000, sellPrice: 1_200 });

    expect(flip.grossMarginPerItem).toBe(200);
    expect(flip.taxPerItem).toBe(24); // 2% of 1,200
    expect(flip.netMarginPerItem).toBe(176);
  });

  it('multiplies by quantity for the total', () => {
    const flip = calculateFlip({ buyPrice: 1_000, sellPrice: 1_200, quantity: 500 });

    expect(flip.totalProfit).toBe(176 * 500);
    expect(flip.totalInvested).toBe(500_000);
  });

  it('computes ROI against capital invested, not against revenue', () => {
    const flip = calculateFlip({ buyPrice: 1_000, sellPrice: 1_200, quantity: 10 });

    // 1,760 profit on 10,000 invested.
    expect(flip.roiPercent).toBeCloseTo(17.6, 5);
  });

  // The case that catches out flippers on thin margins: the trade looks
  // profitable and the tax turns it into a loss.
  it('flags a flip that only loses money after tax', () => {
    const flip = calculateFlip({ buyPrice: 1_000, sellPrice: 1_010 });

    expect(flip.grossMarginPerItem).toBe(10);
    expect(flip.taxPerItem).toBe(20);
    expect(flip.netMarginPerItem).toBe(-10);
    expect(flip.isLoss).toBe(true);
  });

  it('handles an inverted market where the buy price exceeds the sell price', () => {
    const flip = calculateFlip({ buyPrice: 5_000, sellPrice: 1_000, quantity: 3 });

    expect(flip.grossMarginPerItem).toBe(-4_000);
    expect(flip.netMarginPerItem).toBe(-4_020);
    expect(flip.totalProfit).toBe(-12_060);
    expect(flip.isLoss).toBe(true);
    // ROI is against capital invested (15,000), not against revenue — you put
    // in 15,000 and lost 12,060 of it.
    expect(flip.roiPercent).toBeCloseTo(-80.4, 5);
  });

  it('reports no ROI when nothing is invested rather than dividing by zero', () => {
    const flip = calculateFlip({ buyPrice: 0, sellPrice: 1_000, quantity: 0 });

    expect(flip.roiPercent).toBeNull();
    expect(Number.isNaN(flip.totalProfit)).toBe(false);
  });

  it('marks a flip on an exempt item as tax free', () => {
    const flip = calculateFlip({
      buyPrice: 100,
      sellPrice: 150,
      itemName: 'Ring of dueling(8)',
    });

    expect(flip.taxExempt).toBe(true);
    expect(flip.taxPerItem).toBe(0);
    expect(flip.netMarginPerItem).toBe(50);
  });

  it('reports when the 5m cap, not the 2% rate, set the tax', () => {
    const capped = calculateFlip({ buyPrice: 1_000_000_000, sellPrice: 1_100_000_000 });
    expect(capped.taxCapped).toBe(true);
    expect(capped.taxPerItem).toBe(5_000_000);

    const uncapped = calculateFlip({ buyPrice: 1_000, sellPrice: 1_200 });
    expect(uncapped.taxCapped).toBe(false);
  });

  // Every field here is fed from a text input, and NaN propagates silently
  // through the whole result object if it is not stopped at the boundary.
  it('never produces NaN from unparseable input', () => {
    const flip = calculateFlip({
      buyPrice: Number.NaN,
      sellPrice: Number.NaN,
      quantity: Number.NaN,
    });

    expect(flip.netMarginPerItem).toBe(0);
    expect(flip.totalProfit).toBe(0);
    expect(flip.roiPercent).toBeNull();
  });

  it('truncates fractional prices rather than carrying them through', () => {
    const flip = calculateFlip({ buyPrice: 100.9, sellPrice: 200.9 });

    expect(flip.buyPrice).toBe(100);
    expect(flip.sellPrice).toBe(200);
  });
});

describe('assessLiquidity', () => {
  it('reports unknown when there is no volume data at all', () => {
    const assessment = assessLiquidity(null);

    expect(assessment.level).toBe('unknown');
    expect(assessment.hourlyVolume).toBeNull();
    expect(assessment.hoursToFill).toBeNull();
  });

  // The /5m endpoint covers a five-minute block, so twelve blocks make an hour.
  it('extrapolates the 5-minute block to an hourly rate', () => {
    const assessment = assessLiquidity({ highPriceVolume: 10, lowPriceVolume: 5 });

    expect(assessment.hourlyVolume).toBe(180); // (10 + 5) * 12
  });

  it('calls a barely-traded item illiquid', () => {
    // 0 trades in the block => 0/hour, below the illiquid threshold.
    const assessment = assessLiquidity({ highPriceVolume: 0, lowPriceVolume: 0 });

    expect(assessment.level).toBe('illiquid');
    expect(assessment.reason).toMatch(/nobody is buying/i);
  });

  it('separates thin from active at the documented threshold', () => {
    // Just under 100/hour.
    const thin = assessLiquidity({ highPriceVolume: 4, lowPriceVolume: 4 }); // 96/hr
    expect(thin.hourlyVolume).toBeLessThan(LIQUIDITY_THRESHOLDS.thin);
    expect(thin.level).toBe('thin');

    // Exactly at the threshold is active — the boundary is inclusive upward.
    const active = assessLiquidity({ highPriceVolume: 5, lowPriceVolume: 4 }); // 108/hr
    expect(active.level).toBe('active');
  });

  // The number that turns "great margin" into "you will hold this for days".
  it('estimates how long the market takes to absorb your quantity', () => {
    // 12/hour, and you want 60 of them.
    const assessment = assessLiquidity({ highPriceVolume: 1, lowPriceVolume: 0 }, 60);

    expect(assessment.hourlyVolume).toBe(12);
    expect(assessment.hoursToFill).toBe(5);
  });

  it('gives no fill estimate when nothing trades', () => {
    const assessment = assessLiquidity({ highPriceVolume: 0, lowPriceVolume: 0 }, 100);

    expect(assessment.hoursToFill).toBeNull();
  });
});
