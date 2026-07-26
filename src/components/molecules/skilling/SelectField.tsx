import { Select, type SelectOption } from '@/components/atoms/Select';

/**
 * MOLECULE — a labelled `<select>`.
 *
 * Same reasoning as `NumericField`: `Select` renders no label, and an
 * unlabelled control is the commonest accessibility defect in form UI. `id` is
 * required for the same reason too — generating one would force a hook and a
 * client boundary onto a component that needs neither.
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
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-content">
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
        <p id={hintId} className="text-xs text-content-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
