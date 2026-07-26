import { cn } from '@/lib/utils/cn';

/**
 * ATOM — a styled native `<select>`.
 *
 * Native rather than a custom listbox, on purpose. A hand-rolled dropdown means
 * owning keyboard navigation, focus trapping, typeahead and mobile behaviour —
 * and getting one of them wrong is the usual outcome. The native control is
 * accessible for free and renders as the platform picker on phones. Revisit
 * only when a design genuinely needs multi-select or option icons.
 *
 * Still an atom: `<option>` is a DOM element, not one of our components.
 * Labelling is the caller's job, as with `Input`.
 */

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends Omit<React.ComponentPropsWithoutRef<'select'>, 'children'> {
  options: readonly SelectOption[];
  /**
   * Renders a disabled leading option. Use for "choose an item" — a required
   * select with no placeholder silently pre-selects its first option, so the
   * user can submit a value they never picked.
   */
  placeholder?: string;
}

export function Select({ options, placeholder, className, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        'w-full rounded-control border border-border bg-surface-sunken px-3 py-2',
        'text-sm text-content transition-colors hover:border-border-strong',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {placeholder ? (
        <option value="" disabled>
          {placeholder}
        </option>
      ) : null}

      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
