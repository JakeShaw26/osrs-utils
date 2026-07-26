import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuestPlanner } from './QuestPlanner';
import { exportProfile, PROFILE_STORAGE_KEY } from '@/lib/quests/profile';

/**
 * The planner, end to end through the DOM.
 *
 * These tests run against the real dataset, deliberately: the point is that a
 * member can go from an empty page to a correct answer, and the interesting
 * interactions (a level unlocking a quest, a tick banking quest points) only
 * exist when the data is real. Assertions are pinned to quests whose
 * requirements are stable and unambiguous — Cook's Assistant needs nothing,
 * The Knight's Sword needs 10 Mining, Below Ice Mountain needs 16 quest
 * points — rather than to counts that shift when a quest is added.
 */

function levelBox(skill: string) {
  return screen.getByRole('textbox', { name: skill });
}

function rowFor(name: string) {
  const row = screen.getByRole('button', { name }).closest('tr');
  if (!row) throw new Error(`No row for ${name}`);
  return row;
}

async function showAll(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByRole('combobox', { name: 'Show' }), 'all');
}

/**
 * Reads a summary badge by its label, scoped to the section heading it sits
 * beside. Scoping matters: "Quest points" is also a blocker label on many
 * rows, so an unscoped query matches a dozen elements.
 */
function summaryBadge(section: string, label: string): HTMLElement {
  const header = screen.getByRole('heading', { name: section }).parentElement;
  if (!header) throw new Error(`No header for ${section}`);
  const labelNode = within(header).getByText(label);
  if (!labelNode.parentElement) throw new Error(`No badge for ${label}`);
  return labelNode.parentElement;
}

beforeEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe('QuestPlanner — labelling', () => {
  // The single most important assertion in this file. Quest completion is not
  // in the hiscores, so a page that presents ticks as fact is lying.
  it('labels declared completions as self-reported', () => {
    render(<QuestPlanner />);

    expect(screen.getByText('Self-reported')).toBeInTheDocument();
    expect(screen.getByText(/cannot be read from the hiscores/i)).toBeInTheDocument();
  });

  it('states how much of the game is modelled', () => {
    render(<QuestPlanner />);

    expect(screen.getByText(/Covering/)).toHaveTextContent(/Covering \d+ of \d+ quests/);
  });
});

describe('QuestPlanner — the empty state', () => {
  it('offers quests that need nothing, on a fresh account', () => {
    render(<QuestPlanner />);

    expect(screen.getByRole('button', { name: "Cook's Assistant" })).toBeInTheDocument();
  });

  it('does not offer a quest whose levels are unmet', () => {
    render(<QuestPlanner />);

    // Default filter is "Can start now"; 10 Mining is not met at level 1.
    expect(
      screen.queryByRole('button', { name: "The Knight's Sword" }),
    ).not.toBeInTheDocument();
  });

  it('says so when a filter matches nothing', async () => {
    const user = userEvent.setup();
    render(<QuestPlanner />);

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Show' }),
      'declared-complete',
    );

    expect(screen.getByText(/No quests match this filter/i)).toBeInTheDocument();
  });
});

describe('QuestPlanner — level entry', () => {
  it('unlocks a quest once its skill requirement is met', async () => {
    const user = userEvent.setup();
    render(<QuestPlanner />);

    await user.type(levelBox('Mining'), '10');

    expect(
      screen.getByRole('button', { name: "The Knight's Sword" }),
    ).toBeInTheDocument();
  });

  it('shows the shortfall on a blocked quest', async () => {
    const user = userEvent.setup();
    render(<QuestPlanner />);
    await showAll(user);

    const row = rowFor("The Knight's Sword");

    expect(within(row).getByText('Mining')).toBeInTheDocument();
    expect(within(row).getByText(/1 \/ 10/)).toBeInTheDocument();
  });

  it.each([
    ['0', 'below the minimum'],
    ['100', 'above the maximum'],
    ['abc', 'not a number'],
    ['1,000', 'a thousands separator'],
  ])('rejects %s (%s) with a message rather than NaN', async (input) => {
    const user = userEvent.setup();
    render(<QuestPlanner />);

    await user.type(levelBox('Mining'), input);

    expect(levelBox('Mining')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/whole number|maximum|Levels start/i)).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it('does not treat an invalid level as a met requirement', async () => {
    const user = userEvent.setup();
    render(<QuestPlanner />);

    await user.type(levelBox('Mining'), '999');

    expect(
      screen.queryByRole('button', { name: "The Knight's Sword" }),
    ).not.toBeInTheDocument();
  });

  it('keeps the invalid text on screen so the member can fix it', async () => {
    const user = userEvent.setup();
    render(<QuestPlanner />);

    await user.type(levelBox('Mining'), '1,0');

    expect(levelBox('Mining')).toHaveValue('1,0');
  });

  it('clears every level', async () => {
    const user = userEvent.setup();
    render(<QuestPlanner />);
    await user.type(levelBox('Mining'), '55');

    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(levelBox('Mining')).toHaveValue('');
  });

  it('shows total and combat level for what has been entered', () => {
    render(<QuestPlanner />);

    // A fresh account: 23 skills at 1 plus Hitpoints at 10.
    expect(summaryBadge('Your levels', 'Total')).toHaveTextContent('33');
    expect(summaryBadge('Your levels', 'Combat')).toHaveTextContent('3');
  });

  it('recomputes the total as levels are entered', async () => {
    const user = userEvent.setup();
    render(<QuestPlanner />);

    await user.type(levelBox('Mining'), '50');

    expect(summaryBadge('Your levels', 'Total')).toHaveTextContent('82');
  });
});

describe('QuestPlanner — declared completions', () => {
  it('banks quest points when a quest is ticked', async () => {
    const user = userEvent.setup();
    render(<QuestPlanner />);

    await user.click(
      screen.getByRole('checkbox', { name: "Mark Cook's Assistant complete" }),
    );

    expect(summaryBadge('Quests', 'Quest points')).toHaveTextContent('1');
  });

  // Below Ice Mountain is gated purely on 16 quest points, which makes it the
  // cleanest test that banked points actually unlock things.
  it('unlocks a quest-point-gated quest once enough points are declared', async () => {
    const user = userEvent.setup();
    render(<QuestPlanner />);
    await showAll(user);

    expect(within(rowFor('Below Ice Mountain')).getByText(/0 \/ 16/)).toBeInTheDocument();

    // Romeo & Juliet (5) + Goblin Diplomacy (5) + Ernest the Chicken (4)
    // + Demon Slayer (3) = 17.
    for (const quest of [
      'Romeo & Juliet',
      'Goblin Diplomacy',
      'Ernest the Chicken',
      'Demon Slayer',
    ]) {
      await user.click(screen.getByRole('checkbox', { name: `Mark ${quest} complete` }));
    }

    expect(summaryBadge('Quests', 'Quest points')).toHaveTextContent('17');
    expect(
      within(rowFor('Below Ice Mountain')).getByText('Can start'),
    ).toBeInTheDocument();
  });

  it('moves a ticked quest into the marked-complete filter', async () => {
    const user = userEvent.setup();
    render(<QuestPlanner />);
    await user.click(
      screen.getByRole('checkbox', { name: "Mark Cook's Assistant complete" }),
    );

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Show' }),
      'declared-complete',
    );

    expect(screen.getByRole('button', { name: "Cook's Assistant" })).toBeInTheDocument();
  });

  it('untick reverses it', async () => {
    const user = userEvent.setup();
    render(<QuestPlanner />);
    // "All", so the quest stays on screen once it leaves the startable list.
    await showAll(user);

    await user.click(
      screen.getByRole('checkbox', { name: "Mark Cook's Assistant complete" }),
    );
    await user.click(
      screen.getByRole('checkbox', { name: "Mark Cook's Assistant complete" }),
    );

    expect(summaryBadge('Quests', 'Quest points')).toHaveTextContent('0');
  });
});

describe('QuestPlanner — the prerequisite chain', () => {
  it('shows the full chain for a deeply blocked quest', async () => {
    const user = userEvent.setup();
    render(<QuestPlanner />);
    await showAll(user);

    await user.click(screen.getByRole('button', { name: "Heroes' Quest" }));

    // Heroes' Quest needs Dragon Slayer I, which needs 32 quest points.
    const plan = screen.getByRole('heading', { name: /Getting to Heroes' Quest/ });
    expect(plan).toBeInTheDocument();

    const list = plan.parentElement!;
    expect(within(list).getByText('Dragon Slayer I')).toBeInTheDocument();
    expect(within(list).getByText('Lost City')).toBeInTheDocument();
  });

  it('surfaces requirements it cannot check, rather than hiding them', async () => {
    const user = userEvent.setup();
    render(<QuestPlanner />);

    await user.click(screen.getByRole('button', { name: 'Demon Slayer' }));

    expect(screen.getByText(/Not checked by this tool/i)).toBeInTheDocument();
    expect(screen.getByText(/level 27 Delrith/i)).toBeInTheDocument();
  });
});

describe('QuestPlanner — persistence', () => {
  it('saves declared completions to localStorage', async () => {
    const user = userEvent.setup();
    render(<QuestPlanner />);

    await user.click(
      screen.getByRole('checkbox', { name: "Mark Cook's Assistant complete" }),
    );

    const stored = JSON.parse(window.localStorage.getItem(PROFILE_STORAGE_KEY) ?? '{}');
    expect(stored.completed).toContain('cooks-assistant');
  });

  it('saves levels to localStorage', async () => {
    const user = userEvent.setup();
    render(<QuestPlanner />);

    await user.type(levelBox('Mining'), '43');

    const stored = JSON.parse(window.localStorage.getItem(PROFILE_STORAGE_KEY) ?? '{}');
    expect(stored.levels.mining).toBe(43);
  });

  it('restores a stored profile on mount', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      PROFILE_STORAGE_KEY,
      exportProfile({ levels: { mining: 43 }, completed: ['cooks-assistant'] }),
    );

    render(<QuestPlanner />);
    await showAll(user);

    expect(levelBox('Mining')).toHaveValue('43');
    expect(
      screen.getByRole('checkbox', { name: "Mark Cook's Assistant complete" }),
    ).toBeChecked();
  });

  it('starts clean rather than crashing on corrupt stored data', () => {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, '{{{not json');

    render(<QuestPlanner />);

    expect(levelBox('Mining')).toHaveValue('');
  });
});

describe('QuestPlanner — export and import', () => {
  it('exports the current profile as JSON', async () => {
    const user = userEvent.setup();
    render(<QuestPlanner />);
    await user.type(levelBox('Mining'), '43');

    await user.click(screen.getByRole('button', { name: 'Export to box' }));

    const box = screen.getByRole('textbox', { name: 'Profile data' });
    expect(JSON.parse((box as HTMLTextAreaElement).value).levels.mining).toBe(43);
  });

  it('imports a profile and applies it', async () => {
    const user = userEvent.setup();
    render(<QuestPlanner />);
    await showAll(user);

    await user.click(screen.getByRole('textbox', { name: 'Profile data' }));
    await user.paste(
      exportProfile({ levels: { mining: 61 }, completed: ['cooks-assistant'] }),
    );
    await user.click(screen.getByRole('button', { name: 'Import' }));

    expect(screen.getByText(/Profile imported/i)).toBeInTheDocument();
    expect(levelBox('Mining')).toHaveValue('61');
    expect(
      screen.getByRole('checkbox', { name: "Mark Cook's Assistant complete" }),
    ).toBeChecked();
  });

  it('round-trips without losing anything', async () => {
    const user = userEvent.setup();
    render(<QuestPlanner />);
    await user.type(levelBox('Mining'), '43');
    await user.click(
      screen.getByRole('checkbox', { name: "Mark Cook's Assistant complete" }),
    );

    await user.click(screen.getByRole('button', { name: 'Export to box' }));
    const exported = (
      screen.getByRole('textbox', { name: 'Profile data' }) as HTMLTextAreaElement
    ).value;

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    await user.click(screen.getByRole('textbox', { name: 'Profile data' }));
    await user.clear(screen.getByRole('textbox', { name: 'Profile data' }));
    await user.paste(exported);
    await user.click(screen.getByRole('button', { name: 'Import' }));

    expect(levelBox('Mining')).toHaveValue('43');
  });

  it('explains a bad import instead of silently doing nothing', async () => {
    const user = userEvent.setup();
    render(<QuestPlanner />);

    await user.click(screen.getByRole('textbox', { name: 'Profile data' }));
    await user.paste('not json at all');
    await user.click(screen.getByRole('button', { name: 'Import' }));

    expect(screen.getByText(/not valid JSON/i)).toBeInTheDocument();
  });

  it('reports how many unrecognised entries an import skipped', async () => {
    const user = userEvent.setup();
    render(<QuestPlanner />);

    await user.click(screen.getByRole('textbox', { name: 'Profile data' }));
    await user.paste('{"levels":{"mining":43,"nonsense":50}}');
    await user.click(screen.getByRole('button', { name: 'Import' }));

    expect(screen.getByText(/1 unrecognised entry was skipped/i)).toBeInTheDocument();
  });
});

describe('QuestPlanner — hiscores prefill', () => {
  it('fills the level boxes from a successful lookup', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          found: true,
          name: 'Zezima',
          levels: { mining: 71, attack: 60 },
        }),
      ),
    );
    render(<QuestPlanner />);

    await user.type(
      screen.getByRole('textbox', { name: /Load from hiscores/ }),
      'Zezima',
    );
    await user.click(screen.getByRole('button', { name: 'Load levels' }));

    expect(await screen.findByText(/Loaded levels for Zezima/)).toBeInTheDocument();
    expect(levelBox('Mining')).toHaveValue('71');
  });

  // A brand-new account is simply unranked. Treating that as an error would
  // put a failure in front of exactly the members most likely to need this.
  it('treats an unranked player as a normal answer, not an error', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ found: false })),
    );
    render(<QuestPlanner />);

    await user.type(
      screen.getByRole('textbox', { name: /Load from hiscores/ }),
      'Nobody',
    );
    await user.click(screen.getByRole('button', { name: 'Load levels' }));

    expect(await screen.findByText(/not on the hiscores yet/i)).toBeInTheDocument();
  });

  it('falls back to manual entry when the lookup fails', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    render(<QuestPlanner />);

    await user.type(
      screen.getByRole('textbox', { name: /Load from hiscores/ }),
      'Zezima',
    );
    await user.click(screen.getByRole('button', { name: 'Load levels' }));

    expect(await screen.findByText(/Enter levels manually/i)).toBeInTheDocument();
    expect(levelBox('Mining')).toBeEnabled();
  });

  it('does not look up an empty name', () => {
    render(<QuestPlanner />);

    expect(screen.getByRole('button', { name: 'Load levels' })).toBeDisabled();
  });
});
