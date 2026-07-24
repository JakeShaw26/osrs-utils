import { cn } from '@/lib/utils/cn';

/**
 * ATOM — button.
 *
 * Renders a `<button>`; interactivity comes from whatever renders it (a form
 * action, or a client parent). Keeping it free of `"use client"` means it stays
 * usable inside server components — a client directive here would drag every
 * page that renders a button into the JS bundle.
 */

type Variant = 'primary' | 'secondary' | 'ghost';

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-primary-content hover:bg-primary-hover',
  secondary: 'bg-surface-sunken text-content border border-border hover:bg-surface-hover',
  ghost: 'text-content-muted hover:bg-surface-hover hover:text-content',
};

interface ButtonProps extends React.ComponentPropsWithoutRef<'button'> {
  variant?: Variant;
}

export function Button({
  variant = 'primary',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-control px-4 py-2',
        'text-sm font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
