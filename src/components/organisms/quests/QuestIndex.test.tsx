import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuestIndex } from './QuestIndex';
import type { Quest } from '@/lib/quests/types';

/**
 * The quest index.
 *
 * Rendered from fixture data rather than the real dataset: these tests are
 * about the browsing behaviour, and pinning them to real quests would make
 * them fail whenever a quest is added — which is a data change, not a
 * regression. Dataset correctness is `quest-data.test.ts`'s job.
 */

const QUESTS: Quest[] = [
  {
    id: 'cooks-assistant',
    name: "Cook's Assistant",
    members: false,
    questPoints: 1,
    difficulty: 'Novice',
    length: 'Very Short',
    requirements: {},
  },
  {
    id: 'dragon-slayer-i',
    name: 'Dragon Slayer I',
    members: false,
    questPoints: 2,
    difficulty: 'Experienced',
    length: 'Medium',
    requirements: { questPoints: 32 },
  },
  {
    id: 'lost-city',
    name: 'Lost City',
    members: true,
    questPoints: 3,
    difficulty: 'Intermediate',
    length: 'Short',
    requirements: { skills: { crafting: 31, woodcutting: 36 } },
  },
  {
    id: 'heroes-quest',
    name: "Heroes' Quest",
    members: true,
    questPoints: 1,
    difficulty: 'Experienced',
    length: 'Medium',
    requirements: { quests: ['lost-city'] },
  },
];

const NAMES = Object.fromEntries(QUESTS.map((q) => [q.id, q.name]));

function renderIndex() {
  return render(<QuestIndex quests={QUESTS} namesById={NAMES} />);
}

describe('QuestIndex', () => {
  it('lists every quest by default', () => {
    renderIndex();

    expect(screen.getByRole('link', { name: /Cook's Assistant/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Lost City/ })).toBeInTheDocument();
  });

  it('states how many quests are shown', () => {
    renderIndex();

    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 4 of 4');
  });

  it('filters by search text', async () => {
    const user = userEvent.setup();
    renderIndex();

    await user.type(screen.getByRole('searchbox', { name: 'Search quests' }), 'dragon');

    expect(screen.getByRole('link', { name: /Dragon Slayer I/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Lost City/ })).not.toBeInTheDocument();
  });

  it('matches case-insensitively', async () => {
    const user = userEvent.setup();
    renderIndex();

    await user.type(screen.getByRole('searchbox', { name: 'Search quests' }), 'LOST');

    expect(screen.getByRole('link', { name: /Lost City/ })).toBeInTheDocument();
  });

  // The empty state has to say the quest may simply not be modelled yet —
  // "no results" alone reads as "this quest does not exist".
  it('states when nothing matches, and why that may be', async () => {
    const user = userEvent.setup();
    renderIndex();

    await user.type(screen.getByRole('searchbox', { name: 'Search quests' }), 'zzzz');

    expect(screen.getByText(/not yet be in this dataset/i)).toBeInTheDocument();
  });

  it('filters to free-to-play quests', async () => {
    const user = userEvent.setup();
    renderIndex();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Membership' }),
      'free',
    );

    expect(screen.getByRole('link', { name: /Cook's Assistant/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Lost City/ })).not.toBeInTheDocument();
  });

  it('filters to members quests', async () => {
    const user = userEvent.setup();
    renderIndex();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Membership' }),
      'members',
    );

    expect(
      screen.queryByRole('link', { name: /Cook's Assistant/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Lost City/ })).toBeInTheDocument();
  });

  it('shows skill requirements with their levels', () => {
    renderIndex();

    const row = screen.getByRole('link', { name: /Lost City/ }).closest('tr');
    expect(row).not.toBeNull();
    expect(within(row!).getByText('Crafting')).toBeInTheDocument();
    expect(within(row!).getByText('31')).toBeInTheDocument();
  });

  it('shows a quest-point requirement', () => {
    renderIndex();

    const row = screen.getByRole('link', { name: /Dragon Slayer I/ }).closest('tr');
    expect(within(row!).getByText('Quest points')).toBeInTheDocument();
    expect(within(row!).getByText('32')).toBeInTheDocument();
  });

  // Ids are an implementation detail; a member reading the table needs names.
  it('resolves prerequisite ids to quest names', () => {
    renderIndex();

    const row = screen.getByRole('link', { name: /Heroes' Quest/ }).closest('tr');
    expect(within(row!).getByText('Lost City')).toBeInTheDocument();
  });

  it('says "None" for a quest with no prerequisites', () => {
    renderIndex();

    const row = screen.getByRole('link', { name: /Cook's Assistant/ }).closest('tr');
    expect(within(row!).getByText('None')).toBeInTheDocument();
  });
});
