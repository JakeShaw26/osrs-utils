'use client';

import { useId, useMemo, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Select } from '@/components/atoms/Select';
import { StatBadge } from '@/components/atoms/StatBadge';
import {
  Table,
  TableBody,
  TableCell,
  TableEmptyRow,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/components/atoms/Table';
import {
  exportProgress,
  importProgress,
  type ProgressStorage,
} from '@/lib/clues/ca-progress';
import { createCaProgressStore } from '@/lib/clues/ca-store';
import { CA_TIER_ORDER, type CombatAchievement } from '@/lib/clues/ca-types';
import { matchesQuery } from '@/lib/clues/normalise';

/**
 * ORGANISM — self-declared Combat Achievement progress.
 *
 * ## The constraint that shapes everything here
 *
 * Combat Achievements are verified absent from the hiscores and no public API
 * reports a player's completions. With no sign-in and no public write path
 * (ADR-0012), the only place a member's progress can live is their own browser.
 * So:
 *
 *  - Ticking a box writes to `localStorage` and nothing else. No request is
 *    made, no row is written, nobody else can see it.
 *  - It is **self-reported and unverifiable**, stated in the UI, and it feeds
 *    no leaderboard. A ranked table over numbers members type in themselves is
 *    won by whoever lies hardest (PRD §3.4).
 *  - It is **disposable**, so export/import is a first-class control rather
 *    than a settings-page afterthought.
 *
 * The task *catalogue* is real data from the OSRS Wiki, fetched by the page and
 * passed in as props. Only completion is self-declared.
 */

/** Rendering 600+ rows of checkboxes is slow and unreadable. Filter instead. */
const MAX_ROWS = 100;

interface Props {
  achievements: readonly CombatAchievement[];
  /** Injected so tests can supply a fake. Defaults to the real localStorage. */
  storage?: ProgressStorage;
}

function resolveStorage(injected?: ProgressStorage): ProgressStorage | null {
  if (injected) return injected;
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

export function CombatAchievementTracker({ achievements, storage }: Props) {
  const [tier, setTier] = useState('all');
  const [query, setQuery] = useState('');
  const [transfer, setTransfer] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const searchId = useId();
  const tierId = useId();
  const transferId = useId();

  const store = useMemo(() => createCaProgressStore(resolveStorage(storage)), [storage]);

  // `useSyncExternalStore` rather than an effect: localStorage is an external
  // store React does not own, and this is the hook built for reading one
  // without a hydration mismatch or a flash of empty state. See ca-store.ts.
  const completed = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );

  function commit(next: ReadonlySet<number>) {
    if (!store.set(next)) {
      setMessage('Could not save — your browser is blocking storage for this site.');
    }
  }

  function toggle(id: number) {
    const next = new Set(completed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    commit(next);
    setMessage(null);
  }

  const tierOptions = useMemo(
    () => [
      { value: 'all', label: 'All tiers' },
      ...CA_TIER_ORDER.filter((name) =>
        achievements.some((task) => task.tier === name),
      ).map((name) => ({ value: name, label: name })),
    ],
    [achievements],
  );

  const filtered = useMemo(
    () =>
      achievements.filter(
        (task) =>
          (tier === 'all' || task.tier === tier) &&
          (query.trim() === '' ||
            matchesQuery(task.name, query) ||
            matchesQuery(task.monster, query) ||
            matchesQuery(task.task, query)),
      ),
    [achievements, tier, query],
  );

  const visible = filtered.slice(0, MAX_ROWS);
  const completedInScope = filtered.filter((task) => completed.has(task.id)).length;

  function handleExport() {
    setTransfer(exportProgress(completed));
    setMessage('Exported below. Copy it somewhere safe — clearing site data loses this.');
  }

  function handleImport() {
    const result = importProgress(transfer);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    commit(result.ids);
    setMessage(`Imported ${result.ids.size} completed tasks.`);
  }

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="ca-self-reported"
        className="rounded-card border border-warning/40 bg-warning/10 p-4"
      >
        <h2 id="ca-self-reported" className="text-sm font-semibold text-content">
          Self-reported — not verified
        </h2>
        <p className="mt-1 text-sm text-content-muted">
          Combat Achievements are not in the hiscores and no public API exposes them, so
          nothing here is checked against the game. This list is whatever you tick, stored
          only in this browser. It is never sent to us and it never appears on a clan
          leaderboard.
        </p>
      </section>

      <div className="flex flex-wrap gap-2">
        <StatBadge
          label="Ticked"
          value={completed.size}
          tone={completed.size > 0 ? 'success' : 'neutral'}
        />
        <StatBadge label="Tasks in catalogue" value={achievements.length} tone="info" />
        <StatBadge label="Matching filter" value={filtered.length} />
        <StatBadge label="Ticked in filter" value={completedInScope} />
      </div>

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <div>
          <label
            htmlFor={searchId}
            className="mb-1 block text-sm font-medium text-content"
          >
            Search tasks
          </label>
          <Input
            id={searchId}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g. Zulrah"
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor={tierId} className="mb-1 block text-sm font-medium text-content">
            Tier
          </label>
          <Select
            id={tierId}
            options={tierOptions}
            value={tier}
            onChange={(event) => setTier(event.target.value)}
          />
        </div>
      </div>

      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Done</TableHeaderCell>
            <TableHeaderCell>Task</TableHeaderCell>
            <TableHeaderCell>Boss</TableHeaderCell>
            <TableHeaderCell>Tier</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {visible.length === 0 ? (
            <TableEmptyRow colSpan={4}>
              {achievements.length === 0
                ? 'The task catalogue could not be loaded from the OSRS Wiki. Your ticked tasks are safe in this browser.'
                : 'No task matches that filter.'}
            </TableEmptyRow>
          ) : (
            visible.map((task) => (
              <TableRow key={task.id}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={completed.has(task.id)}
                    onChange={() => toggle(task.id)}
                    aria-label={task.name}
                  />
                </TableCell>
                <TableCell>
                  <span className="font-medium text-content">{task.name}</span>
                  <span className="block text-content-muted">{task.task}</span>
                </TableCell>
                <TableCell>{task.monster}</TableCell>
                <TableCell>{task.tier}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {filtered.length > visible.length ? (
        <p className="text-sm text-content-muted">
          Showing the first <span className="tabular">{visible.length}</span> of{' '}
          <span className="tabular">{filtered.length}</span> matches. Narrow the search or
          pick a tier to see the rest.
        </p>
      ) : null}

      <section aria-labelledby="ca-transfer" className="space-y-2">
        <h2 id="ca-transfer" className="text-sm font-semibold text-content">
          Back up or move your progress
        </h2>
        <p className="text-sm text-content-muted">
          This lives in one browser only. Clearing site data, using a different device or
          browsing privately all lose it — so export it somewhere you keep things.
        </p>
        <label htmlFor={transferId} className="mb-1 block text-sm text-content-subtle">
          Progress file
        </label>
        <textarea
          id={transferId}
          value={transfer}
          onChange={(event) => setTransfer(event.target.value)}
          rows={5}
          spellCheck={false}
          className="w-full rounded-control border border-border bg-surface-sunken px-3 py-2 font-mono text-sm text-content"
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={handleExport}>
            Export
          </Button>
          <Button variant="secondary" onClick={handleImport}>
            Import
          </Button>
        </div>
        {message ? (
          <p role="status" className="text-sm text-content-muted">
            {message}
          </p>
        ) : null}
      </section>
    </div>
  );
}
