import { cn } from '@/lib/utils/cn';

/**
 * ATOMS — table primitives.
 *
 * Several exports in one file because they are one thing: thin styled wrappers
 * over `<table>` elements. Each renders a DOM element and never one of our
 * components, so each is an atom by the rule in components/README.md — the
 * caller composes them, which is what keeps a data-aware `ClanLeaderboard` an
 * organism rather than making this one.
 *
 * There is no `<Table data={…} columns={…}>` here, and that is deliberate. A
 * generic data table accretes sorting, filtering, pagination and formatting
 * until it is the hardest component in the codebase. Almost every table this
 * app needs is a leaderboard or a price list rendered from a server component.
 *
 * **`numeric` is the load-bearing prop.** Nearly every column here is GP, XP,
 * a level or a DPS figure; without tabular figures and right alignment, digits
 * change width between rows and columns become unreadable (docs/theming.md).
 */

/**
 * Wraps the table in its own horizontal scroll container. Wide numeric tables
 * on a phone must scroll themselves rather than making the whole page scroll
 * sideways.
 */
export function Table({ className, ...props }: React.ComponentPropsWithoutRef<'table'>) {
  return (
    <div className="w-full overflow-x-auto rounded-card border border-border">
      <table className={cn('w-full border-collapse text-sm', className)} {...props} />
    </div>
  );
}

export function TableHead({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'thead'>) {
  return <thead className={cn('bg-surface-sunken', className)} {...props} />;
}

export function TableBody(props: React.ComponentPropsWithoutRef<'tbody'>) {
  return <tbody {...props} />;
}

export function TableRow({ className, ...props }: React.ComponentPropsWithoutRef<'tr'>) {
  return (
    <tr
      className={cn(
        'border-b border-border last:border-0 hover:bg-surface-hover',
        className,
      )}
      {...props}
    />
  );
}

interface CellProps extends React.ComponentPropsWithoutRef<'td'> {
  /** Right-aligns and applies `.tabular`. Use for every GP/XP/level column. */
  numeric?: boolean;
}

export function TableHeaderCell({ numeric, className, ...props }: CellProps) {
  return (
    <th
      // Without an explicit scope, a screen reader cannot tell a column header
      // from a row header, and the table reads as an undifferentiated grid.
      scope="col"
      className={cn(
        'px-3 py-2 text-2xs font-medium tracking-wide text-content-subtle uppercase',
        numeric ? 'text-right' : 'text-left',
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ numeric, className, ...props }: CellProps) {
  return (
    <td
      className={cn(
        'px-3 py-2 text-content',
        numeric ? 'tabular text-right' : 'text-left',
        className,
      )}
      {...props}
    />
  );
}

/**
 * A full-width "nothing here" row.
 *
 * Exists so empty states are consistent and, more usefully, so they are hard to
 * skip. An empty table with no message reads as a bug — and with upstream data
 * that can legitimately be empty or stale, "no results" needs to be stated
 * rather than implied.
 */
export function TableEmptyRow({
  colSpan,
  children,
}: {
  colSpan: number;
  children: React.ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-8 text-center text-sm text-content-muted">
        {children}
      </td>
    </tr>
  );
}
