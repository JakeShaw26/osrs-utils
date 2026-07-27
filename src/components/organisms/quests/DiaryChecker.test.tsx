import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DiaryChecker } from './DiaryChecker';
import { PROFILE_STORAGE_KEY, exportProfile } from '@/lib/quests/profile';

/**
 * The diary requirement checker.
 *
 * The assertions that matter are about honesty rather than arithmetic: this
 * page must never imply it knows what a member has completed, because diaries
 * are absent from the hiscores. Ardougne Easy is used as the worked example —
 * it needs 5 Thieving and nothing else that a fresh account lacks, which makes
 * it the one tier a level entry can flip on its own.
 */

function rowFor(diary: string, tier: string) {
  const cell = screen
    .getAllByRole('cell', { name: diary })
    .map((node) => node.closest('tr'))
    .find((row) => row && within(row).queryByRole('cell', { name: tier }));
  if (!cell) throw new Error(`No row for ${diary} ${tier}`);
  return cell;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('DiaryChecker', () => {
  it('labels everything as self-reported and achievability-only', () => {
    render(<DiaryChecker />);

    expect(screen.getByText('Self-reported')).toBeInTheDocument();
    expect(screen.getByText(/cannot be read from the hiscores/i)).toBeInTheDocument();
    expect(screen.getAllByText(/achievable/i).length).toBeGreaterThan(0);
  });

  it('lists all twelve diaries across four tiers', () => {
    render(<DiaryChecker />);

    expect(screen.getAllByRole('cell', { name: 'Elite' })).toHaveLength(12);
    expect(screen.getAllByRole('cell', { name: 'Ardougne' })).toHaveLength(4);
  });

  it('shows a fresh account as unable to complete Ardougne Easy', () => {
    render(<DiaryChecker />);

    expect(within(rowFor('Ardougne', 'Easy')).getByText('Not yet')).toBeInTheDocument();
  });

  it('flips a tier to achievable once its levels are entered', async () => {
    const user = userEvent.setup();
    render(<DiaryChecker />);

    await user.type(screen.getByRole('textbox', { name: 'Thieving' }), '5');

    expect(
      within(rowFor('Ardougne', 'Easy')).getByText('Levels met'),
    ).toBeInTheDocument();
  });

  it('names the skill standing in the way', () => {
    render(<DiaryChecker />);

    const row = rowFor('Ardougne', 'Easy');
    expect(within(row).getByText('Thieving')).toBeInTheDocument();
    expect(within(row).getByText(/1 \/ 5/)).toBeInTheDocument();
  });

  // Both pages read the same browser-local profile, so levels typed on the
  // planner have to be visible here without retyping.
  it('reads levels saved by the planner', () => {
    window.localStorage.setItem(
      PROFILE_STORAGE_KEY,
      exportProfile({ levels: { thieving: 42 }, completed: [] }),
    );

    render(<DiaryChecker />);

    expect(screen.getByRole('textbox', { name: 'Thieving' })).toHaveValue('42');
  });

  it('states that quest requirements for diary tasks are not modelled', () => {
    render(<DiaryChecker />);

    expect(screen.getByText(/does not model/i)).toBeInTheDocument();
  });

  it('rejects an out-of-range level without producing NaN', async () => {
    const user = userEvent.setup();
    render(<DiaryChecker />);

    await user.type(screen.getByRole('textbox', { name: 'Thieving' }), '150');

    expect(screen.getByRole('textbox', { name: 'Thieving' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });
});
