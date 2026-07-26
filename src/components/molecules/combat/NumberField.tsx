import { Input } from '@/components/atoms/Input';

/**
 * MOLECULE — a label and a numeric input, which is one job.
 *
 * `Input` deliberately renders no label of its own, so every caller would
 * otherwise re-solve the same accessibility problem. The `<label>` **wraps**
 * the control rather than pointing at an id: implicit association needs no
 * `useId`, which keeps this usable from a server component.
 *
 * `onValueChange` hands back a number rather than an event. Every consumer was
 * writing the same `Number(event.target.value)` and inheriting the same bug —
 * an empty field parses to `NaN`, which then propagates through the whole
 * calculation and renders as "NaN". Empty reports as `null` instead, and the
 * caller decides what an empty field means.
 */

interface NumberFieldProps {
  label: string;
  value: number;
  onValueChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
  disabled?: boolean;
  invalid?: boolean;
}

export function NumberField({
  label,
  value,
  onValueChange,
  min,
  max,
  step,
  hint,
  disabled,
  invalid,
}: NumberFieldProps) {
  return (
    // The hint sits OUTSIDE the <label> deliberately. Inside, its text joins the
    // control's accessible name — "Potion +19 levels" — so a screen reader (and
    // a `getByRole` query) sees a name that changes as the value changes.
    <div className="flex flex-col gap-1">
      <label className="flex flex-col gap-1">
        <span className="text-2xs font-medium tracking-wide text-content-subtle uppercase">
          {label}
        </span>
        <Input
          numeric
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : ''}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          invalid={invalid}
          onChange={(event) => {
            const raw = event.target.value.trim();
            if (raw === '') {
              onValueChange(null);
              return;
            }
            const parsed = Number(raw);
            onValueChange(Number.isFinite(parsed) ? parsed : null);
          }}
        />
      </label>
      {hint ? <span className="text-xs text-content-muted">{hint}</span> : null}
    </div>
  );
}
