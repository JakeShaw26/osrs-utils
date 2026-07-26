'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { exportProfile, importProfile, type QuestProfile } from '@/lib/quests/profile';

/**
 * ORGANISM — export and import of the browser-local profile.
 *
 * This is not a nice-to-have. Removing accounts (ADR-0012) means declared
 * completions live in `localStorage` and vanish when a member clears site data
 * or switches device — the ADR names export/import as the mitigation. Burying
 * it in a menu would leave members to discover the problem after losing the
 * data, so it sits on the page.
 *
 * The textarea is the transport rather than a file picker: it works on mobile,
 * it survives being pasted into Discord, and it lets a member see exactly what
 * they are storing. A download button is offered as well for a real backup.
 */

interface ProfileBackupProps {
  profile: QuestProfile;
  onImport: (profile: QuestProfile) => void;
}

type ImportState =
  | { status: 'idle' }
  | { status: 'ok'; dropped: number }
  | { status: 'error'; message: string };

export function ProfileBackup({ profile, onImport }: ProfileBackupProps) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<ImportState>({ status: 'idle' });

  function handleExport() {
    setText(exportProfile(profile));
    setResult({ status: 'idle' });
  }

  function handleImport() {
    const parsed = importProfile(text);
    if (!parsed.ok) {
      setResult({ status: 'error', message: parsed.error });
      return;
    }
    onImport(parsed.profile);
    setResult({ status: 'ok', dropped: parsed.dropped });
  }

  function handleDownload() {
    const blob = new Blob([exportProfile(profile)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'osrs-quest-profile.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section aria-labelledby="backup-heading" className="flex flex-col gap-3">
      <h2 id="backup-heading" className="text-lg font-semibold text-content">
        Back up your progress
      </h2>
      <p className="text-sm text-content-muted">
        Everything you declare is stored only in this browser. Clearing site data or
        switching device loses it — export a copy and keep it somewhere safe.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={handleExport}>
          Export to box
        </Button>
        <Button variant="secondary" onClick={handleDownload}>
          Download file
        </Button>
        <Button onClick={handleImport} disabled={text.trim() === ''}>
          Import
        </Button>
      </div>

      <label
        htmlFor="backup-text"
        className="text-2xs font-medium tracking-wide text-content-subtle uppercase"
      >
        Profile data
      </label>
      <textarea
        id="backup-text"
        value={text}
        rows={6}
        spellCheck={false}
        placeholder="Paste an exported profile here, then choose Import."
        onChange={(event) => setText(event.target.value)}
        className="w-full rounded-control border border-border bg-surface-sunken px-3 py-2 font-mono text-xs text-content placeholder:text-content-subtle"
      />

      <p aria-live="polite" className="text-sm">
        {result.status === 'error' ? (
          <span className="text-danger">{result.message}</span>
        ) : null}
        {result.status === 'ok' ? (
          <span className="text-success">
            Profile imported.
            {result.dropped > 0
              ? ` ${result.dropped} unrecognised ${result.dropped === 1 ? 'entry was' : 'entries were'} skipped.`
              : null}
          </span>
        ) : null}
      </p>
    </section>
  );
}
