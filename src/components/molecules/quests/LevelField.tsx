'use client';

import { useId } from 'react';
import { Input } from '@/components/atoms/Input';

/**
 * MOLECULE — one labelled level box.
 *
 * A label plus an input is two atoms doing one job, which is exactly the
 * molecule test in components/README.md. The shared `Input` atom deliberately
 * renders no label, so this is where the association is made — via a real
 * `htmlFor`/`id` pair rather than a placeholder, so the field is reachable by
 * its accessible name.
 *
 * `"use client"` sits here rather than on the page: this is the smallest leaf
 * that needs an event handler, and putting the directive further up would drag
 * the whole planner page into the bundle.
 */

interface LevelFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Set when the current text is not a usable level. */
  error?: string;
}

export function LevelField({ label, value, onChange, error }: LevelFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="text-2xs font-medium tracking-wide text-content-subtle uppercase"
      >
        {label}
      </label>
      <Input
        id={id}
        numeric
        inputMode="numeric"
        // type="text" not "number": a number input silently discards what a
        // member types when it is not parseable, so "1,000" becomes "" and the
        // validation message we want to show never gets its input.
        type="text"
        maxLength={3}
        value={value}
        invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? (
        <p id={errorId} className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
