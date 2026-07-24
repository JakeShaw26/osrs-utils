/**
 * Minimal class-name joiner.
 *
 * Deliberately not clsx + tailwind-merge yet: with a token-based system,
 * conflicting utilities (`bg-surface bg-surface-raised`) mostly indicate a
 * component doing too much, and reaching for a merge library tends to hide
 * that rather than fix it. Revisit if variant-heavy components make it painful.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
