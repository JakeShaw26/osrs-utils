'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { PriceTag } from '@/components/atoms/PriceTag';
import { Select } from '@/components/atoms/Select';
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
import {
  DEATH_RULES_VERSION,
  calculateDeathRisk,
  type CarriedItem,
  type PricedItem,
} from '@/lib/utility/death-risk';
import { parseCountInput, parseGpInput } from '@/lib/utility/parse';

/**
 * ORGANISM — wilderness death-risk calculator.
 *
 * Owns the form; owns none of the rules. Which items survive, how many, and
 * what that costs is `calculateDeathRisk` in `lib/utility/death-risk.ts`, so
 * the part that can be wrong about the game is unit-tested without rendering
 * anything. This file only decides what the answer looks like.
 *
 * The priced catalogue arrives as a prop. Organisms may receive data; they do
 * not fetch it (components/README.md rule 2), and here that also keeps the
 * upstream call to one cached bulk request made in the route.
 */

interface DeathRiskCalculatorProps {
  catalogue: readonly PricedItem[];
  /** Set when live prices could not be loaded — the tool still works manually. */
  pricesError?: string | null;
}

interface Row extends CarriedItem {
  /** True for a hand-entered item, which has no GE price behind it. */
  custom: boolean;
}

export function DeathRiskCalculator({
  catalogue,
  pricesError = null,
}: DeathRiskCalculatorProps) {
  const ids = useId();
  // Per-instance, not module scope: a module-level counter is shared state that
  // leaks between mounts, and the same item added twice must get distinct keys.
  const nextRowId = useRef(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [skulled, setSkulled] = useState(false);
  const [protectItem, setProtectItem] = useState(false);

  const [pickedId, setPickedId] = useState('');
  const [customName, setCustomName] = useState('');
  const [customValue, setCustomValue] = useState('');

  const parsedCustomValue = parseGpInput(customValue);
  const customValueInvalid = customValue.trim() !== '' && parsedCustomValue === null;
  const canAddCustom = customName.trim() !== '' && parsedCustomValue !== null;

  const result = useMemo(
    () => calculateDeathRisk(rows, { skulled, protectItem }),
    [rows, skulled, protectItem],
  );

  function addFromCatalogue() {
    const item = catalogue.find((entry) => entry.id === pickedId);
    if (!item) return;
    setRows((current) => [
      ...current,
      {
        id: `row-${nextRowId.current++}`,
        name: item.name,
        unitValue: item.unitValue,
        quantity: 1,
        custom: false,
      },
    ]);
    setPickedId('');
  }

  function addCustom() {
    if (parsedCustomValue === null || customName.trim() === '') return;
    setRows((current) => [
      ...current,
      {
        id: `row-${nextRowId.current++}`,
        name: customName.trim(),
        unitValue: parsedCustomValue,
        quantity: 1,
        custom: true,
      },
    ]);
    setCustomName('');
    setCustomValue('');
  }

  function setQuantity(rowId: string, raw: string) {
    const quantity = parseCountInput(raw);
    if (quantity === null) return;
    setRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, quantity } : row)),
    );
  }

  function removeRow(rowId: string) {
    setRows((current) => current.filter((row) => row.id !== rowId));
  }

  const keptIds = new Set(result.kept.map((item) => item.id));

  return (
    <div className="grid gap-6">
      <fieldset className="grid gap-3">
        <legend className="text-2xs font-semibold tracking-wide text-content-subtle uppercase">
          Death conditions
        </legend>

        <label className="flex items-center gap-2 text-sm text-content">
          <input
            type="checkbox"
            checked={skulled}
            onChange={(event) => setSkulled(event.target.checked)}
          />
          Skulled
        </label>

        <label className="flex items-center gap-2 text-sm text-content">
          <input
            type="checkbox"
            checked={protectItem}
            onChange={(event) => setProtectItem(event.target.checked)}
          />
          Protect Item active
        </label>

        <p className="text-sm text-content-muted">
          Keeping <strong className="tabular">{result.keptCount}</strong>{' '}
          {result.keptCount === 1 ? 'item' : 'items'}.
        </p>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="text-2xs font-semibold tracking-wide text-content-subtle uppercase">
          What are you carrying?
        </legend>

        {pricesError ? (
          <p className="rounded-control border border-warning bg-surface-sunken p-3 text-sm text-warning">
            {pricesError} Add items by hand below — the rules still apply, only the prices
            are missing.
          </p>
        ) : null}

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-56 flex-1">
            <label
              htmlFor={`${ids}-pick`}
              className="mb-1 block text-sm text-content-muted"
            >
              Common gear
            </label>
            <Select
              id={`${ids}-pick`}
              value={pickedId}
              onChange={(event) => setPickedId(event.target.value)}
              placeholder={catalogue.length === 0 ? 'No live prices' : 'Choose an item…'}
              disabled={catalogue.length === 0}
              options={catalogue.map((item) => ({
                value: item.id,
                label: item.name,
              }))}
            />
          </div>
          <Button onClick={addFromCatalogue} disabled={pickedId === ''}>
            Add item
          </Button>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-40 flex-1">
            <label
              htmlFor={`${ids}-name`}
              className="mb-1 block text-sm text-content-muted"
            >
              Other item
            </label>
            <Input
              id={`${ids}-name`}
              value={customName}
              onChange={(event) => setCustomName(event.target.value)}
              placeholder="Item name"
            />
          </div>
          <div className="min-w-32">
            <label
              htmlFor={`${ids}-value`}
              className="mb-1 block text-sm text-content-muted"
            >
              Value each
            </label>
            <Input
              id={`${ids}-value`}
              numeric
              value={customValue}
              invalid={customValueInvalid}
              aria-describedby={customValueInvalid ? `${ids}-value-error` : undefined}
              onChange={(event) => setCustomValue(event.target.value)}
              placeholder="1.5m"
            />
          </div>
          <Button variant="secondary" onClick={addCustom} disabled={!canAddCustom}>
            Add custom
          </Button>
        </div>

        {customValueInvalid ? (
          <p id={`${ids}-value-error`} role="alert" className="text-sm text-danger">
            Enter a number — `1000`, `1,000` and `1k` all work.
          </p>
        ) : null}
      </fieldset>

      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Item</TableHeaderCell>
            <TableHeaderCell numeric>Each</TableHeaderCell>
            <TableHeaderCell numeric>Qty</TableHeaderCell>
            <TableHeaderCell>Fate</TableHeaderCell>
            <TableHeaderCell>
              <span className="sr-only">Remove</span>
            </TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 ? (
            <TableEmptyRow colSpan={5}>
              Nothing added yet — an empty inventory risks nothing.
            </TableEmptyRow>
          ) : (
            rows.map((row) => {
              const kept = keptIds.has(row.id);
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.name}
                    {row.custom ? (
                      <span className="ml-2 text-2xs text-content-subtle">manual</span>
                    ) : null}
                  </TableCell>
                  <TableCell numeric>
                    <PriceTag amount={row.unitValue} />
                  </TableCell>
                  <TableCell numeric>
                    <Input
                      numeric
                      aria-label={`Quantity of ${row.name}`}
                      defaultValue={String(row.quantity)}
                      onChange={(event) => setQuantity(row.id, event.target.value)}
                      className="w-24"
                    />
                  </TableCell>
                  <TableCell>
                    <StatBadge
                      tone={kept ? 'success' : 'danger'}
                      value={kept ? 'Kept' : 'Lost'}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      aria-label={`Remove ${row.name}`}
                      onClick={() => removeRow(row.id)}
                    >
                      ✕
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <div
        role="group"
        aria-label="Death risk summary"
        className="grid gap-2 rounded-card border border-border bg-surface-sunken p-4 sm:grid-cols-3"
      >
        <div>
          <p className="text-2xs tracking-wide text-content-subtle uppercase">Risked</p>
          {/* text-loss, not text-danger: losing a bank is a market outcome, not
              a validation failure. The domain tokens are deliberately separate
              from the status tokens (docs/theming.md). */}
          <PriceTag amount={result.riskValue} className="text-2xl text-loss" />
        </div>
        <div>
          <p className="text-2xs tracking-wide text-content-subtle uppercase">Kept</p>
          <PriceTag amount={result.keptValue} className="text-2xl text-profit" />
        </div>
        <div>
          <p className="text-2xs tracking-wide text-content-subtle uppercase">Carried</p>
          <PriceTag amount={result.totalValue} className="text-2xl" />
        </div>
      </div>

      <p className="text-2xs text-content-subtle">Rule set {DEATH_RULES_VERSION}</p>
    </div>
  );
}
