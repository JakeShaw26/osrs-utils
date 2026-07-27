import { cn } from '@/lib/utils/cn';

/**
 * TEMPLATE — the shared shell for every calculator page.
 *
 * Qualifies as a template: it defines layout and slots, and fetches nothing.
 * Data fetching and authorisation happen in app/, and flow down as props or
 * children. A template that fetches is an organism wearing a disguise.
 *
 * Exists so that ~20 calculators across combat, skilling and economy share one
 * page rhythm instead of each inventing its own heading sizes and spacing.
 *
 * The `notes` slot is deliberately part of the template rather than optional
 * decoration: most tools rest on assumptions (xp/hr estimates, GE tax rates,
 * data freshness) that the PRD requires us to surface rather than bury. Making
 * it a first-class slot means authors are prompted to fill it in.
 */

/**
 * Content width. A named prop rather than a `max-w-*` class through
 * `className`, because `cn()` joins classes without merging them (see
 * `lib/utils/cn.ts`, which rejects tailwind-merge on purpose). Passing
 * `className="max-w-6xl"` shipped BOTH `max-w-4xl` and `max-w-6xl`, leaving CSS
 * source order to decide — which made the override **silently direction
 * dependent**: Tailwind emits max-width utilities in ascending order, so
 * widening happened to win and narrowing was silently ignored.
 *
 * Measured in the generated stylesheet: `.max-w-2xl` < `.max-w-4xl` <
 * `.max-w-6xl`. A page asking for `max-w-2xl` got `max-w-4xl` and no error.
 *
 * One prop, one class, no conflict possible.
 */
export type ContentWidth = 'default' | 'wide' | 'full';

const WIDTH_CLASS: Record<ContentWidth, string> = {
  default: 'max-w-4xl',
  /** Dense tables that need the horizontal room. */
  wide: 'max-w-5xl',
  full: 'max-w-6xl',
};

interface CalculatorLayoutProps {
  title: string;
  description?: string;
  /** The interactive tool itself — usually the one client organism on the page. */
  children: React.ReactNode;
  /** Assumptions, caveats, data source and freshness. */
  notes?: React.ReactNode;
  width?: ContentWidth;
  /**
   * Spacing and colour only. **Not width** — use `width`. A `max-w-*` here
   * conflicts with the template's own and resolves by stylesheet order.
   */
  className?: string;
}

export function CalculatorLayout({
  title,
  description,
  children,
  notes,
  width = 'default',
  className,
}: CalculatorLayoutProps) {
  return (
    <main
      className={cn(
        'mx-auto w-full px-4 py-8 sm:px-6 lg:py-12',
        WIDTH_CLASS[width],
        className,
      )}
    >
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-content sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-content-muted">{description}</p>
        ) : null}
      </header>

      <section className="rounded-card border border-border bg-surface-raised p-4 shadow-card sm:p-6">
        {children}
      </section>

      {notes ? (
        <aside className="mt-6 rounded-card border border-border bg-surface-sunken p-4">
          <h2 className="text-2xs font-semibold tracking-wide text-content-subtle uppercase">
            Assumptions &amp; data
          </h2>
          <div className="mt-2 text-sm text-content-muted">{notes}</div>
        </aside>
      ) : null}
    </main>
  );
}
