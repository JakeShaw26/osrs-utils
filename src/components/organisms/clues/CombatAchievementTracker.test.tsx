import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CombatAchievementTracker } from './CombatAchievementTracker';
import { CA_PROGRESS_STORAGE_KEY } from '@/lib/clues/ca-progress';
import type { CombatAchievement } from '@/lib/clues/ca-types';
import type { ProgressStorage } from '@/lib/clues/ca-progress';

const TASKS: readonly CombatAchievement[] = [
  {
    id: 1,
    name: 'Abyssal Adept',
    monster: 'Abyssal Sire',
    task: 'Kill the Abyssal Sire 20 times.',
    tier: 'Hard',
    type: 'Kill Count',
  },
  {
    id: 2,
    name: 'Noxious Foe',
    monster: 'Aberrant Spectre',
    task: 'Kill an Aberrant Spectre.',
    tier: 'Easy',
    type: 'Kill Count',
  },
];

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  const storage: ProgressStorage = {
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
  return { storage, data };
}

describe('CombatAchievementTracker', () => {
  it('labels itself self-reported and unverified', () => {
    // Not decoration. CAs are absent from the hiscores, so nothing here is
    // checked against the game, and presenting it as fact would be a lie the
    // member cannot detect.
    render(
      <CombatAchievementTracker achievements={TASKS} storage={fakeStorage().storage} />,
    );

    expect(
      screen.getByRole('heading', { name: /self-reported — not verified/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/never appears on a clan leaderboard/i)).toBeInTheDocument();
  });

  it('saves a ticked task to storage', async () => {
    const user = userEvent.setup();
    const { storage, data } = fakeStorage();
    render(<CombatAchievementTracker achievements={TASKS} storage={storage} />);

    await user.click(screen.getByRole('checkbox', { name: 'Abyssal Adept' }));

    expect(JSON.parse(data[CA_PROGRESS_STORAGE_KEY] ?? '').completedIds).toEqual([1]);
  });

  it('restores previously ticked tasks on mount', () => {
    const { storage } = fakeStorage({
      [CA_PROGRESS_STORAGE_KEY]: JSON.stringify({ completedIds: [2] }),
    });

    render(<CombatAchievementTracker achievements={TASKS} storage={storage} />);

    expect(screen.getByRole('checkbox', { name: 'Noxious Foe' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Abyssal Adept' })).not.toBeChecked();
  });

  it('unticks a task again', async () => {
    const user = userEvent.setup();
    const { storage, data } = fakeStorage({
      [CA_PROGRESS_STORAGE_KEY]: JSON.stringify({ completedIds: [1] }),
    });
    render(<CombatAchievementTracker achievements={TASKS} storage={storage} />);

    await user.click(screen.getByRole('checkbox', { name: 'Abyssal Adept' }));

    expect(JSON.parse(data[CA_PROGRESS_STORAGE_KEY] ?? '').completedIds).toEqual([]);
  });

  it('exports progress into the transfer box', async () => {
    const user = userEvent.setup();
    const { storage } = fakeStorage({
      [CA_PROGRESS_STORAGE_KEY]: JSON.stringify({ completedIds: [1, 2] }),
    });
    render(<CombatAchievementTracker achievements={TASKS} storage={storage} />);

    await user.click(screen.getByRole('button', { name: 'Export' }));

    const box = screen.getByRole('textbox', { name: /progress file/i });
    expect(JSON.parse((box as HTMLTextAreaElement).value).completedIds).toEqual([1, 2]);
  });

  it('imports a pasted progress file and applies it to the checkboxes', async () => {
    // Export/import is the only durability this data has — browser storage is
    // lost on a clear or a device change (ADR-0012).
    const user = userEvent.setup();
    const { storage } = fakeStorage();
    render(<CombatAchievementTracker achievements={TASKS} storage={storage} />);

    // `paste` rather than `type`: userEvent reads `{` and `[` as key syntax, and
    // a progress file is full of both.
    await user.click(screen.getByRole('textbox', { name: /progress file/i }));
    await user.paste(JSON.stringify({ version: 1, completedIds: [2] }));
    await user.click(screen.getByRole('button', { name: 'Import' }));

    expect(screen.getByRole('checkbox', { name: 'Noxious Foe' })).toBeChecked();
    expect(screen.getByRole('status')).toHaveTextContent(/imported 1 completed tasks/i);
  });

  it('reports a bad import instead of silently wiping progress', async () => {
    const user = userEvent.setup();
    const { storage } = fakeStorage({
      [CA_PROGRESS_STORAGE_KEY]: JSON.stringify({ completedIds: [1] }),
    });
    render(<CombatAchievementTracker achievements={TASKS} storage={storage} />);

    await user.type(screen.getByRole('textbox', { name: /progress file/i }), 'not json');
    await user.click(screen.getByRole('button', { name: 'Import' }));

    expect(screen.getByRole('status')).toHaveTextContent(/not valid json/i);
    // The ticked task must survive a failed import.
    expect(screen.getByRole('checkbox', { name: 'Abyssal Adept' })).toBeChecked();
  });

  it('filters by tier', async () => {
    const user = userEvent.setup();
    render(
      <CombatAchievementTracker achievements={TASKS} storage={fakeStorage().storage} />,
    );

    await user.selectOptions(screen.getByRole('combobox', { name: /tier/i }), 'Easy');

    expect(screen.getByRole('checkbox', { name: 'Noxious Foe' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Abyssal Adept' })).toBeNull();
  });

  it('states an empty filter result rather than showing a blank table', async () => {
    const user = userEvent.setup();
    render(
      <CombatAchievementTracker achievements={TASKS} storage={fakeStorage().storage} />,
    );

    await user.type(screen.getByRole('textbox', { name: /search tasks/i }), 'zzzzzz');

    expect(screen.getByText(/no task matches that filter/i)).toBeInTheDocument();
  });

  it('still works, and says why, when the Wiki catalogue failed to load', () => {
    // "Degrade, don't break": the member's own ticked tasks are local and must
    // not be thrown away because an upstream was down.
    render(
      <CombatAchievementTracker achievements={[]} storage={fakeStorage().storage} />,
    );

    expect(
      screen.getByText(/task catalogue could not be loaded from the OSRS Wiki/i),
    ).toBeInTheDocument();
  });

  it('shows the size of the catalogue it is tracking against', () => {
    render(
      <CombatAchievementTracker achievements={TASKS} storage={fakeStorage().storage} />,
    );

    const badge = screen.getByText('Tasks in catalogue').parentElement as HTMLElement;
    expect(within(badge).getByText('2')).toBeInTheDocument();
  });
});
