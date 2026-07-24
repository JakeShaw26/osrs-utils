'use client';

import { useSyncExternalStore } from 'react';
import { THEME_STORAGE_KEY } from '@/lib/theme/theme-script';
import { cn } from '@/lib/utils/cn';

/**
 * MOLECULE — light/dark switch.
 *
 * The ONLY client component in this scaffold, and a deliberate illustration of
 * the boundary rule from PRD §6.1: interactivity forces "use client", so the
 * directive goes on the smallest possible leaf. The page that renders this stays
 * a server component; hoisting "use client" to the page would drag every atom on
 * it into the JS bundle for no reason.
 *
 * The theme class is applied by a blocking script before paint (see
 * lib/theme/theme-script). This component reads and flips it.
 *
 * useSyncExternalStore rather than useState + useEffect: the source of truth is
 * the DOM, which is external to React. The effect version calls setState during
 * the effect, causing a cascading render — React's linter rejects it. This hook
 * exists exactly for "read external state, with a different value on the server",
 * and it handles the hydration difference correctly via getServerSnapshot.
 */

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
  return () => observer.disconnect();
}

function getSnapshot(): boolean {
  return document.documentElement.classList.contains('dark');
}

/** Server can't know the user's theme; dark is the default (docs/theming.md). */
function getServerSnapshot(): boolean {
  return true;
}

export function ThemeToggle({ className }: { className?: string }) {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    const next = !isDark;
    // Mutating the class notifies the MutationObserver above, which re-renders.
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light');
    } catch {
      // Blocked storage (private mode) — the toggle still works for this session.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-control border border-border',
        'bg-surface-raised text-content-muted transition-colors',
        'hover:bg-surface-hover hover:text-content',
        className,
      )}
    >
      <span aria-hidden className="text-sm">
        {isDark ? '☾' : '☀'}
      </span>
    </button>
  );
}
