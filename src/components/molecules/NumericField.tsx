import { Input } from '@/components/atoms/Input';

/**
 * MOLECULE — a labelled numeric field, with hint, error and optional suffix.
 *
 * Replaces `combat/NumberField`, `skilling/NumericField` and `quests/LevelField`,
 * which six parallel agents wrote independently because the `Input` atom
 * deliberately renders no label. Nothing failed as a result — which is why the
 * duplication had to be written down rather than noticed.
 *
 * **Two modes, because both behaviours were justified.** The merge takes the
 * union rather than the intersection, the same way `lib/utils/parse-quantity.ts`
 * did:
 *
 * - `mode="text"` (default) is NOT `type="number"`. Players paste `1,000` and
 *   type `13m`, both of which a native number input silently discards, handing
 *   the caller an empty string that reads as 0. Parsing is the caller's job —
 *   see `lib/utils/parse-quantity.ts`.
 * - `mode="number"` is a real `type="number"`, for levels and gear bonuses where
 *   shorthand is meaningless and `min`/`max`/`step` are worth having. It reports
 *   `null` rather than `NaN` for an empty field, so a cleared box cannot poison
 *   a calculation and render as the string "NaN".
 *
 * `id` is required rather than generated with `useId`. A hook would force
 * `"use client"` onto this file and drag every form-bearing page into the
 * bundle. It also keeps `getByRole('textbox', { name })` honest in tests.
 *
 * The hint is `aria-describedby`, never inside the `<label>`. Hint text changes
 * as the value changes ("+19 levels"), and inside the label it would join the
 * control's accessible name — so a screen reader would announce a control whose
 * name shifts while you type.
 */

interface CommonProps {
  id: string;
  label: string;
  /** Static guidance, always shown. */
  hint?: string;
  /** Validation message. Its presence marks the field invalid. */
  error?: string;
  /** Marks the field invalid without a message. `error` implies this. */
  invalid?: boolean;
  placeholder?: string;
  disabled?: boolean;
  /** Rendered after the input — a unit, or a computed read-back. */
  suffix?: React.ReactNode;
}

interface TextModeProps {
  mode?: 'text';
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}

interface NumberModeProps {
  mode: 'number';
  value: number;
  /** Empty reports `null`; the caller decides what an empty field means. */
  onValueChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
}

export type NumericFieldProps = CommonProps & (TextModeProps | NumberModeProps);

export function NumericField(props: NumericFieldProps) {
  const { id, label, hint, error, invalid, placeholder, disabled, suffix } = props;

  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  const shared = {
    id,
    numeric: true,
    disabled,
    placeholder,
    invalid: Boolean(error) || invalid,
    // Both ids, so a screen reader reads the hint AND the error rather than the
    // error silently replacing the guidance needed to fix it.
    'aria-describedby': [hintId, errorId].filter(Boolean).join(' ') || undefined,
  };

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="text-2xs font-medium tracking-wide text-content-subtle uppercase"
      >
        {label}
      </label>

      <div className="flex items-center gap-2">
        {props.mode === 'number' ? (
          <Input
            {...shared}
            type="number"
            inputMode="decimal"
            value={Number.isFinite(props.value) ? props.value : ''}
            min={props.min}
            max={props.max}
            step={props.step}
            onChange={(event) => {
              const raw = event.target.value.trim();
              if (raw === '') {
                props.onValueChange(null);
                return;
              }
              const parsed = Number(raw);
              props.onValueChange(Number.isFinite(parsed) ? parsed : null);
            }}
          />
        ) : (
          <Input
            {...shared}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={props.maxLength}
            value={props.value}
            onChange={(event) => props.onChange(event.target.value)}
          />
        )}

        {suffix ? (
          <span className="tabular shrink-0 text-sm text-content-muted">{suffix}</span>
        ) : null}
      </div>

      {hint ? (
        <p id={hintId} className="text-xs text-content-muted">
          {hint}
        </p>
      ) : null}

      {error ? (
        // role="alert" so the message is announced when it appears, not only
        // when the field is next focused.
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
