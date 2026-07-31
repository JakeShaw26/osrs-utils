import { Select, type SelectOption } from '@/components/atoms/Select';

/**
 * MOLECULE — a labelled `<select>`. The `Select` counterpart to
 * [`NumericField`](./NumericField.tsx), and labelled the same way.
 *
 * Replaces `combat/SelectField` and `skilling/SelectField`, which were written
 * independently and differed only in their label styling and callback name.
 *
 * `id` is required for the same reason as in `NumericField`: generating one
 * would need `useId`, which would force a client boundary onto a component that
 * needs neither.
 */

interface SelectFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  hint?: string;
  disabled?: boolean;
}

export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  hint,
  disabled,
}: SelectFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="text-2xs font-medium tracking-wide text-content-subtle uppercase"
      >
        {label}
      </label>

      <Select
        id={id}
        value={value}
        options={options}
        disabled={disabled}
        aria-describedby={hintId}
        onChange={(event) => onChange(event.target.value)}
      />

      {hint ? (
        <p id={hintId} className="text-xs text-content-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Turns a list of names into `<Select>` options where the value is the label. */
export function toOptions(values: readonly string[]): SelectOption[] {
  return values.map((value) => ({ value, label: value }));
}
