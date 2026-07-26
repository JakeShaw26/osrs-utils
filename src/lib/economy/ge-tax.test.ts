import { describe, expect, it } from 'vitest';
import {
  GE_TAX_CAP_PER_ITEM,
  GE_TAX_FREE_BELOW,
  GE_TAX_RATE,
  geTax,
  isTaxExempt,
  netSaleProceeds,
} from './ge-tax';

/**
 * These tests pin open question V3.
 *
 * The rate and cap were verified against the OSRS Wiki on 2026-07-26 and the
 * expectations below are hand-computed from the published rules, not from our
 * own implementation. If Jagex changes the tax again, these should fail — that
 * is the point. Re-verify against the wiki before touching a number here.
 */
describe('GE tax constants', () => {
  it('encodes the verified 2% rate and 5m per-item cap', () => {
    expect(GE_TAX_RATE).toBe(0.02);
    expect(GE_TAX_CAP_PER_ITEM).toBe(5_000_000);
  });

  // Derived from the rate, not hardcoded: 2% of 49 floors to 0, 2% of 50 is 1.
  it('derives the tax-free threshold from the rate', () => {
    expect(GE_TAX_FREE_BELOW).toBe(50);
  });
});

describe('geTax', () => {
  it('is zero below the threshold, because the tax rounds down', () => {
    expect(geTax(1)).toBe(0);
    expect(geTax(49)).toBe(0);
  });

  // The exact boundary: 50 * 0.02 = 1.0, the first price that owes a coin.
  it('charges its first coin at the threshold', () => {
    expect(geTax(50)).toBe(1);
  });

  it('charges 2% just above the threshold', () => {
    expect(geTax(51)).toBe(1); // 1.02 floors to 1
    expect(geTax(100)).toBe(2);
    expect(geTax(1_000)).toBe(20);
  });

  it('rounds down rather than to nearest', () => {
    // 2% of 149 is 2.98. Rounding to nearest would give 3 and overstate the
    // tax on every item in a large stack.
    expect(geTax(149)).toBe(2);
  });

  // The cap binds from 250,000,000 upward at a 2% rate.
  it('applies 2% right up to the cap boundary', () => {
    expect(geTax(249_999_999)).toBe(4_999_999);
    expect(geTax(250_000_000)).toBe(5_000_000);
  });

  it('caps above the boundary instead of continuing at 2%', () => {
    expect(geTax(250_000_001)).toBe(GE_TAX_CAP_PER_ITEM);
    // A twisted-bow-scale sale: 2% would be ~29.5m, but the cap holds it at 5m.
    expect(geTax(1_478_143_929)).toBe(GE_TAX_CAP_PER_ITEM);
  });

  it('charges nothing on exempt items at any price', () => {
    expect(geTax(10_000_000, 'Old school bond')).toBe(0);
    expect(geTax(500, 'Nature rune')).toBe(10); // not exempt
  });

  it('treats a half-typed price as zero rather than NaN', () => {
    expect(geTax(Number.NaN)).toBe(0);
    expect(geTax(-5)).toBe(0);
    expect(geTax(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('isTaxExempt', () => {
  it('matches regardless of case', () => {
    expect(isTaxExempt('lobster')).toBe(true);
    expect(isTaxExempt('LOBSTER')).toBe(true);
    expect(isTaxExempt('Lobster')).toBe(true);
  });

  // The wiki lists the charged variants explicitly, and the item ids differ per
  // charge — so `Ring of dueling(8)` being exempt says nothing about `(7)`.
  it('only exempts the exact charged variants the wiki lists', () => {
    expect(isTaxExempt('Ring of dueling(8)')).toBe(true);
    expect(isTaxExempt('Ring of dueling(7)')).toBe(false);
    expect(isTaxExempt('Games necklace(8)')).toBe(true);
  });

  it('does not exempt an unknown or missing name', () => {
    expect(isTaxExempt('Twisted bow')).toBe(false);
    expect(isTaxExempt(null)).toBe(false);
    expect(isTaxExempt(undefined)).toBe(false);
    expect(isTaxExempt('')).toBe(false);
  });
});

describe('netSaleProceeds', () => {
  it('returns the price minus the tax', () => {
    expect(netSaleProceeds(1_000)).toBe(980);
  });

  it('returns the full price for an exempt item', () => {
    expect(netSaleProceeds(1_000, 'Bread')).toBe(1_000);
  });

  it('loses only the cap on a very expensive item', () => {
    expect(netSaleProceeds(1_000_000_000)).toBe(995_000_000);
  });
});
