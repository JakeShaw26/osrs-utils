import { Input } from '@/components/atoms/Input';

/**
 * MOLECULE — a labelled numeric field with hint and error text.
 *
 * A label plus an input plus its messages is two or three atoms doing one job,
 * which is the molecule test in components/README.md. `Input` deliberately
 * renders no label of its own, so without this every skilling form would wire
 * up its own `aria-describedby` and half of them would get it wrong.
 *
 * `id` is required rather than generated with `useId`. Generating it would need
 * a hook, which would force `"use client"` onto this file and drag it into the
 * bundle even when a server page only wants to render a static form. An
 * explicit id also makes `getByRole('textbox', { name })` in tests honest.
 *
 * NOT `type="number"`. Players paste `1,000` and type `13m`, both of which a
 * native number input discards, handing the caller an empty string that reads
 * as 0. `inputMode="numeric"` still raises the numeric keypad on a phone.
 * Parsing is `lib/skilling/parse-quantity.ts`.
 */

interface NumericFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Static guidance, always shown. */
  hint?: string;
  /** Validation message. Its presence marks the field invalid. */
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Rendered after the input — a unit, or a computed read-back. */
  suffix?: React.ReactNode;
}

export function NumericField({
  id,
  label,
  value,
  onChange,
  hint,
  error,
  placeholder,
  disabled,
  suffix,
}: NumericFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-content">
        {label}
      </label>

      <div className="flex items-center gap-2">
        <Input
          id={id}
          numeric
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          invalid={Boolean(error)}
          // Both ids, so a screen reader reads the hint AND the error rather
          // than the error silently replacing the guidance.
          aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
          onChange={(event) => onChange(event.target.value)}
        />
        {suffix ? (
          <span className="tabular shrink-0 text-sm text-content-muted">{suffix}</span>
        ) : null}
      </div>

      {hint ? (
        <p id={hintId} className="text-xs text-content-subtle">
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
