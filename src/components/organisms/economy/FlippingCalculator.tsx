'use client';

import { useId, useState } from 'react';
import { Input } from '@/components/atoms/Input';
import { StatTile } from '@/components/atoms/economy/StatTile';
import { LiquidityWarning } from '@/components/molecules/economy/LiquidityWarning';
import { assessLiquidity, calculateFlip } from '@/lib/economy/flipping';
import { GE_TAX_CAP_PER_ITEM, GE_TAX_RATE } from '@/lib/economy/ge-tax';
import { parseGp, parseQuantity } from '@/lib/economy/parse-gp';
import { formatGp, formatGpExact } from '@/lib/utils/format-gp';

/**
 * ORGANISM — the flipping calculator.
 *
 * `"use client"` is genuinely required here: the figures recompute on every
 * keystroke, which is the entire value of the tool. It sits at the leaf, so the
 * page rendering it stays a server component and the item data it is seeded
 * with is fetched on the server.
 *
 * All the maths is in `lib/economy/` — `calculateFlip`, `geTax`,
 * `assessLiquidity`, `parseGp`. This component owns three pieces of state and
 * some formatting. That split is what lets the tax be tested at the threshold,
 * at the cap and on an inverted market without rendering anything.
 *
 * Inputs are TEXT, not `type="number"`. Players type `1.5m` and paste
 * `1,478,143` — a number input silently yields an empty string for both, so
 * the calculator would read 0 and display a confident, wrong margin. Parsing
 * ourselves means we can tell "not filled in" from "zero" from "nonsense".
 */

interface FlippingCalculatorProps {
  /** Prefills the form when arriving from an item page. */
  initialItemName?: string;
  initialBuyPrice?: number | null;
  initialSellPrice?: number | null;
  initialQuantity?: number | null;
  /** Live `/5m` volumes for the liquidity warning. Null when unknown. */
  volume?: { highPriceVolume: number; lowPriceVolume: number } | null;
}

function toFieldValue(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

export function FlippingCalculator({
  initialItemName,
  initialBuyPrice,
  initialSellPrice,
  initialQuantity,
  volume = null,
}: FlippingCalculatorProps) {
  const fieldId = useId();
  const [buyRaw, setBuyRaw] = useState(() => toFieldValue(initialBuyPrice));
  const [sellRaw, setSellRaw] = useState(() => toFieldValue(initialSellPrice));
  const [quantityRaw, setQuantityRaw] = useState(() =>
    toFieldValue(initialQuantity ?? 1),
  );

  const buyPrice = parseGp(buyRaw);
  const sellPrice = parseGp(sellRaw);
  const quantity = parseQuantity(quantityRaw);

  // "Typed something we could not read" is a different state from "empty", and
  // only the first deserves an error message.
  const buyInvalid = buyRaw.trim() !== '' && buyPrice === null;
  const sellInvalid = sellRaw.trim() !== '' && sellPrice === null;
  const quantityInvalid = quantityRaw.trim() !== '' && quantity === null;

  const ready = buyPrice !== null && sellPrice !== null && buyPrice > 0 && sellPrice > 0;

  const flip = ready
    ? calculateFlip({
        buyPrice,
        sellPrice,
        quantity: quantity ?? 1,
        itemName: initialItemName,
      })
    : null;

  const liquidity = assessLiquidity(volume, quantity ?? 1);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label
            htmlFor={`${fieldId}-buy`}
            className="mb-1 block text-sm font-medium text-content"
          >
            Buy price
          </label>
          <Input
            id={`${fieldId}-buy`}
            numeric
            // `decimal` rather than `numeric` so the phone keypad still offers
            // the characters "1.5m" needs.
            inputMode="decimal"
            placeholder="0"
            value={buyRaw}
            invalid={buyInvalid}
            aria-describedby={buyInvalid ? `${fieldId}-buy-error` : undefined}
            onChange={(event) => setBuyRaw(event.target.value)}
          />
          {buyInvalid ? (
            <p
              id={`${fieldId}-buy-error`}
              role="alert"
              className="mt-1 text-xs text-danger"
            >
              Enter a number — 1500, 1,500 or 1.5k all work.
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor={`${fieldId}-sell`}
            className="mb-1 block text-sm font-medium text-content"
          >
            Sell price
          </label>
          <Input
            id={`${fieldId}-sell`}
            numeric
            inputMode="decimal"
            placeholder="0"
            value={sellRaw}
            invalid={sellInvalid}
            aria-describedby={sellInvalid ? `${fieldId}-sell-error` : undefined}
            onChange={(event) => setSellRaw(event.target.value)}
          />
          {sellInvalid ? (
            <p
              id={`${fieldId}-sell-error`}
              role="alert"
              className="mt-1 text-xs text-danger"
            >
              Enter a number — 1500, 1,500 or 1.5k all work.
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor={`${fieldId}-qty`}
            className="mb-1 block text-sm font-medium text-content"
          >
            Quantity
          </label>
          <Input
            id={`${fieldId}-qty`}
            numeric
            inputMode="decimal"
            placeholder="1"
            value={quantityRaw}
            invalid={quantityInvalid}
            aria-describedby={quantityInvalid ? `${fieldId}-qty-error` : undefined}
            onChange={(event) => setQuantityRaw(event.target.value)}
          />
          {quantityInvalid ? (
            <p
              id={`${fieldId}-qty-error`}
              role="alert"
              className="mt-1 text-xs text-danger"
            >
              Enter a whole number of items.
            </p>
          ) : null}
        </div>
      </div>

      {/* Results are announced politely: they change as the user types, and an
          assertive region would interrupt on every keystroke. */}
      <div aria-live="polite">
        {flip === null ? (
          <p className="rounded-card border border-border bg-surface-sunken px-4 py-8 text-center text-sm text-content-muted">
            Enter a buy and a sell price to see the margin after tax.
          </p>
        ) : (
          <>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                label="Margin per item"
                value={`${formatGp(flip.netMarginPerItem)} gp`}
                tone={flip.isLoss ? 'loss' : 'profit'}
                hint={`${formatGp(flip.grossMarginPerItem)} gp before tax`}
              />
              <StatTile
                label="GE tax per item"
                value={`${formatGp(flip.taxPerItem)} gp`}
                hint={
                  flip.taxExempt
                    ? 'Exempt item — no tax'
                    : flip.taxCapped
                      ? `Capped at ${formatGp(GE_TAX_CAP_PER_ITEM)} gp`
                      : `${(GE_TAX_RATE * 100).toFixed(0)}% of the sell price`
                }
              />
              <StatTile
                label="Total profit"
                value={`${formatGp(flip.totalProfit)} gp`}
                tone={flip.isLoss ? 'loss' : 'profit'}
                hint={`on ${formatGpExact(flip.quantity)} items`}
              />
              <StatTile
                label="Return on investment"
                value={flip.roiPercent === null ? '—' : `${flip.roiPercent.toFixed(2)}%`}
                tone={flip.isLoss ? 'loss' : 'profit'}
                hint={`${formatGp(flip.totalInvested)} gp invested`}
              />
            </dl>

            {flip.isLoss ? (
              <p role="status" className="mt-3 text-sm text-loss">
                This flip loses {formatGp(Math.abs(flip.netMarginPerItem))} gp per item
                after tax.
                {flip.grossMarginPerItem > 0
                  ? ' The margin is positive before tax — the tax is what makes it a loss.'
                  : ' The sell price is below the buy price.'}
              </p>
            ) : null}
          </>
        )}
      </div>

      <div className="rounded-card border border-border bg-surface-sunken p-4">
        <h3 className="mb-2 text-2xs font-semibold tracking-wide text-content-subtle uppercase">
          Liquidity
        </h3>
        <LiquidityWarning assessment={liquidity} />
      </div>
    </div>
  );
}
