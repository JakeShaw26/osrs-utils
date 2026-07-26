import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MinigamePointsCalculator } from './MinigamePointsCalculator';

function setup() {
  const user = userEvent.setup();
  render(<MinigamePointsCalculator />);
  return user;
}

function result() {
  return screen.getByRole('group', { name: 'Result' });
}

/** The headline count. `role="status"` makes it the one live region on the page. */
function runsShown() {
  return screen.getByRole('status');
}

async function setTarget(user: ReturnType<typeof userEvent.setup>, value: string) {
  const target = screen.getByRole('textbox', { name: 'Points you want' });
  await user.clear(target);
  if (value !== '') await user.type(target, value);
}

async function setField(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  value: string,
) {
  const field = screen.getByRole('textbox', { name });
  await user.clear(field);
  await user.type(field, value);
}

describe('MinigamePointsCalculator', () => {
  it('shows no answer until a target is entered', () => {
    setup();

    expect(runsShown()).toHaveTextContent(/^—$/);
  });

  it('rounds up, because a partial game earns nothing', async () => {
    const user = setup();

    // Pest Control novice is 3 points a game; 100 points is 33⅓ games.
    await setTarget(user, '100');

    expect(runsShown()).toHaveTextContent(/^34$/);
  });

  it('subtracts the points you already have', async () => {
    const user = setup();

    await setTarget(user, '100');
    await setField(user, 'Points you already have', '40');

    expect(runsShown()).toHaveTextContent(/^20$/);
  });

  it('says so when the target is already met rather than showing a negative count', async () => {
    const user = setup();

    await setTarget(user, '10');
    await setField(user, 'Points you already have', '50');

    expect(runsShown()).toHaveTextContent(/^0$/);
    expect(screen.getByText('You already have enough points.')).toBeInTheDocument();
  });

  it('uses the points for the lander you pick', async () => {
    const user = setup();

    await setTarget(user, '100');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Result per game' }),
      'veteran',
    );

    // 5 points a game instead of 3.
    expect(runsShown()).toHaveTextContent(/^20$/);
  });

  it('fills the target from a common reward', async () => {
    const user = setup();

    await user.click(screen.getByRole('button', { name: /Full Void set/ }));

    // 850 points at 3 a game.
    expect(runsShown()).toHaveTextContent(/^284$/);
  });

  it('estimates the playing time from the rate', async () => {
    const user = setup();

    await setTarget(user, '36');
    await setField(user, 'Games per hour', '12');

    // 12 games at 12 an hour.
    expect(within(result()).getByText('1h')).toBeInTheDocument();
  });

  // Switching minigames must not leave a mode id from the previous one in
  // place, which would silently fall back to its first mode and change the
  // answer without the user touching anything.
  it('resets the mode when a different minigame is chosen', async () => {
    const user = setup();

    await setTarget(user, '100');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Minigame' }),
      'mahogany-homes',
    );

    expect(
      screen.getByRole('combobox', { name: 'Result per contract' }),
    ).toBeInTheDocument();
    // Beginner contracts are 2 points, so 100 points is 50 contracts.
    expect(runsShown()).toHaveTextContent(/^50$/);
  });

  describe('invalid input', () => {
    it('refuses an unparseable target instead of rendering NaN', async () => {
      const user = setup();

      await setTarget(user, 'soon');

      expect(screen.getByRole('alert')).toHaveTextContent('Enter a number of points.');
      expect(runsShown()).toHaveTextContent(/^—$/);
      expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    });

    it('refuses a zero rate rather than dividing by nothing', async () => {
      const user = setup();

      await setTarget(user, '100');
      await setField(user, 'Games per hour', '0');

      expect(screen.getByRole('alert')).toHaveTextContent('Enter a rate above zero.');
      // The run count is still answerable — only the time estimate is not.
      expect(runsShown()).toHaveTextContent(/^34$/);
      expect(screen.queryByText(/Infinity/)).not.toBeInTheDocument();
    });
  });

  // Authored data, graded honestly. An unmarked guess reads exactly like a fact.
  it('warns when a point table is player-reported rather than documented', async () => {
    const user = setup();
    const warning =
      'Player-reported, not from a primary source. Check before committing hours.';

    // Pest Control's table is documented, so no warning.
    expect(screen.queryByText(warning)).not.toBeInTheDocument();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Minigame' }),
      'castle-wars',
    );

    expect(screen.getByText(warning)).toBeInTheDocument();
  });
});
