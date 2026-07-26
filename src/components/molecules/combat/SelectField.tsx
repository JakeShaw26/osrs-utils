import { Select, type SelectOption } from '@/components/atoms/Select';

/**
 * MOLECULE — a label and a select. The `Select` counterpart to `NumberField`,
 * and labelled the same way (wrapping `<label>`, no `useId`, no client boundary).
 */

interface SelectFieldProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SelectOption[];
  hint?: string;
  disabled?: boolean;
}

export function SelectField({
  label,
  value,
  onValueChange,
  options,
  hint,
  disabled,
}: SelectFieldProps) {
  return (
    // Hint outside the <label> — see the note in `NumberField`.
    <div className="flex flex-col gap-1">
      <label className="flex flex-col gap-1">
        <span className="text-2xs font-medium tracking-wide text-content-subtle uppercase">
          {label}
        </span>
        <Select
          value={value}
          options={options}
          disabled={disabled}
          onChange={(event) => onValueChange(event.target.value)}
        />
      </label>
      {hint ? <span className="text-xs text-content-muted">{hint}</span> : null}
    </div>
  );
}

/** Turns a list of names into `<Select>` options where the value is the label. */
export function toOptions(values: readonly string[]): SelectOption[] {
  return values.map((value) => ({ value, label: value }));
}
