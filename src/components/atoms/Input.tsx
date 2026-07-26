import { cn } from '@/lib/utils/cn';

/**
 * ATOM — a styled text input.
 *
 * No `"use client"`: an uncontrolled input works fine inside a server
 * component, and adding the directive here would drag every page containing a
 * form field into the JS bundle. A client parent supplies `value`/`onChange`
 * when it needs them.
 *
 * **This deliberately renders no label.** A label plus an input is two things
 * doing one job, which is a molecule. The consequence is that callers must
 * supply `aria-label` or wire up a `<label htmlFor>` — an unlabelled input is
 * unusable with a screen reader, and it is the single most common
 * accessibility defect in form UI.
 */

interface InputProps extends React.ComponentPropsWithoutRef<'input'> {
  /**
   * Right-aligns and applies `.tabular`. Use for any GP/XP/level field —
   * proportional digits change width as you type, so the cursor and the
   * numbers jitter.
   */
  numeric?: boolean;
  invalid?: boolean;
}

export function Input({ numeric, invalid, className, ...props }: InputProps) {
  return (
    <input
      // Communicates the error state to assistive tech, not just to sighted
      // users via the border colour.
      aria-invalid={invalid || undefined}
      className={cn(
        'w-full rounded-control border bg-surface-sunken px-3 py-2 text-sm',
        'text-content placeholder:text-content-subtle',
        'transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        invalid ? 'border-danger' : 'border-border hover:border-border-strong',
        numeric && 'tabular text-right',
        className,
      )}
      {...props}
    />
  );
}
