import Link from 'next/link';
import { StatBadge } from '@/components/atoms/StatBadge';
import { cn } from '@/lib/utils/cn';

/**
 * ORGANISM — a self-contained, linkable summary of one tool.
 *
 * Qualifies as an organism rather than a molecule: it is a complete, meaningful
 * section of a page on its own (the tool directory is a grid of these), it
 * carries domain vocabulary (members-only, phase availability), and it owns its
 * own layout rather than just arranging two atoms.
 *
 * Still a SERVER component — it renders links, not interactivity. Organisms are
 * not automatically client components; only interactivity forces that boundary,
 * and pushing "use client" up the tree needlessly drags the whole subtree into
 * the bundle. (PRD §6.1)
 */

interface FeatureCardProps {
  title: string;
  description: string;
  href: string;
  /** Shown when the tool is not built yet — this scaffold has no features. */
  comingSoon?: boolean;
  membersOnly?: boolean;
  className?: string;
}

export function FeatureCard({
  title,
  description,
  href,
  comingSoon = false,
  membersOnly = false,
  className,
}: FeatureCardProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-content">{title}</h3>
        <div className="flex shrink-0 gap-1.5">
          {membersOnly ? <StatBadge tone="members" value="Members" /> : null}
          {comingSoon ? <StatBadge tone="neutral" value="Soon" /> : null}
        </div>
      </div>
      <p className="mt-2 text-sm text-content-muted">{description}</p>
    </>
  );

  const shared = cn(
    'block rounded-card border border-border bg-surface-raised p-4 shadow-card transition-colors',
    className,
  );

  if (comingSoon) {
    return (
      <div className={cn(shared, 'cursor-not-allowed opacity-60')} aria-disabled>
        {content}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={cn(shared, 'hover:border-border-strong hover:bg-surface-hover')}
    >
      {content}
    </Link>
  );
}
