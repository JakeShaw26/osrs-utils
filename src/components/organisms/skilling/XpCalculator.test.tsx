import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { XpCalculator } from './XpCalculator';

/**
 * The formulas are tested once, in `lib/skilling/xp.test.ts`. What is asserted
 * here is what the component does with them: that a typed value reaches the
 * screen, and that the invalid, empty and error states are visible rather than
 * silently producing NaN.
 */

const CURRENT = /^Current .* XP$/;
const TARGET = /^Target .* level$/;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('XpCalculator', () => {
  const fetchStub = vi.fn();

  beforeEach(() => {
    fetchStub.mockReset();
    vi.stubGlobal('fetch', fetchStub);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts with nothing to show and says so', () => {
    render(<XpCalculator />);

    expect(screen.getByText(/enter your current xp and a target/i)).toBeInTheDocument();
  });

  it('computes XP remaining from a current total and a target level', async () => {
    const user = userEvent.setup();
    render(<XpCalculator />);

    await user.type(screen.getByRole('textbox', { name: CURRENT }), '737627');

    // 13,034,431 - 737,627
    expect(screen.getByText('12,296,804')).toBeInTheDocument();
    expect(screen.getByText('70')).toBeInTheDocument(); // current level
  });

  /**
   * Users paste `1,000` and type `13m` constantly, because the game itself
   * renders numbers that way. `Number('13m')` is NaN — the whole reason the
   * inputs are text with a parser in front of them.
   */
  it.each([
    ['13,034,431', 'already at the target'],
    ['13034431', 'plain digits'],
  ])('accepts %s (%s)', async (typed) => {
    const user = userEvent.setup();
    render(<XpCalculator />);

    await user.type(screen.getByRole('textbox', { name: CURRENT }), typed);

    expect(screen.getByText(/you are already there/i)).toBeInTheDocument();
  });

  it('accepts k/m shorthand and shows a real number, never NaN', async () => {
    const user = userEvent.setup();
    render(<XpCalculator />);

    await user.type(screen.getByRole('textbox', { name: CURRENT }), '1m');

    expect(screen.getByText('12,034,431')).toBeInTheDocument();
    expect(screen.queryByText(/nan/i)).not.toBeInTheDocument();
  });

  it('shows an error for text it cannot read, rather than treating it as zero', async () => {
    const user = userEvent.setup();
    render(<XpCalculator />);

    await user.type(screen.getByRole('textbox', { name: CURRENT }), 'lots');

    expect(screen.getByRole('alert')).toHaveTextContent(/enter a number/i);
    expect(screen.queryByText(/nan/i)).not.toBeInTheDocument();
  });

  it('shows no error while the field is still empty', () => {
    render(<XpCalculator />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  /** The commonest user error: typing the goal into the "current" box. */
  it('tells the user when their target is below where they already are', async () => {
    const user = userEvent.setup();
    render(<XpCalculator />);

    await user.type(screen.getByRole('textbox', { name: CURRENT }), '13m');
    await user.clear(screen.getByRole('textbox', { name: TARGET }));
    await user.type(screen.getByRole('textbox', { name: TARGET }), '50');

    expect(screen.getByRole('alert')).toHaveTextContent(
      /lower than where you already are/i,
    );
  });

  it('rejects a target level above 99 and points at the XP mode instead', async () => {
    const user = userEvent.setup();
    render(<XpCalculator />);

    await user.type(screen.getByRole('textbox', { name: CURRENT }), '1m');
    await user.clear(screen.getByRole('textbox', { name: TARGET }));
    await user.type(screen.getByRole('textbox', { name: TARGET }), '120');

    expect(screen.getByRole('alert')).toHaveTextContent(/99 is the highest level/i);
  });

  it('converts a current level to XP when the level mode is chosen', async () => {
    const user = userEvent.setup();
    render(<XpCalculator />);

    const currentMode = screen.getByRole('radiogroup', { name: /current input mode/i });
    await user.click(within(currentMode).getByRole('radio', { name: 'Level' }));
    await user.type(screen.getByRole('textbox', { name: /^Current .* level$/ }), '70');

    // 13,034,431 - 737,627 (the XP at level 70)
    expect(screen.getByText('12,296,804')).toBeInTheDocument();
  });

  /**
   * The boundary the calculator exists to get right. Level 99 is not the end of
   * XP — a 99 with 13.5m has 186.5m still to gain, and saying "you are done"
   * would be wrong.
   */
  it('explains that level 99 is not the XP ceiling', async () => {
    const user = userEvent.setup();
    render(<XpCalculator />);

    const targetMode = screen.getByRole('radiogroup', { name: /target input mode/i });
    await user.click(within(targetMode).getByRole('radio', { name: 'XP' }));
    await user.type(screen.getByRole('textbox', { name: CURRENT }), '13500000');
    await user.clear(screen.getByRole('textbox', { name: /^Target .* XP$/ }));
    await user.type(screen.getByRole('textbox', { name: /^Target .* XP$/ }), '50m');

    expect(screen.getByText(/the xp ceiling is/i)).toBeInTheDocument();
    expect(screen.getByText('36,500,000')).toBeInTheDocument();
  });

  it('rounds the action count up', async () => {
    const user = userEvent.setup();
    render(<XpCalculator />);

    await user.type(screen.getByRole('textbox', { name: CURRENT }), '13034331');
    await user.type(screen.getByRole('textbox', { name: /xp per action/i }), '75');

    // 100 XP left at 75 per action is 1.33 actions -> 2, never 1.
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('states an empty level breakdown rather than showing a blank table', async () => {
    const user = userEvent.setup();
    render(<XpCalculator />);

    // Already 99, targeting 99 — there are no levels in between, and an empty
    // table with no message reads as a bug.
    await user.type(screen.getByRole('textbox', { name: CURRENT }), '13034431');

    expect(
      screen.getByText(/no levels between here and your target/i),
    ).toBeInTheDocument();
  });

  /* --- The optional hiscores prefill -------------------------------------- */

  it('fills the current XP box from a successful lookup', async () => {
    const user = userEvent.setup();
    fetchStub.mockResolvedValue(
      jsonResponse({
        status: 'found',
        rsn: 'zezima',
        skills: [{ name: 'Fletching', level: 70, xp: 737_627 }],
      }),
    );
    render(<XpCalculator />);

    await user.type(
      screen.getByRole('textbox', { name: /look up current xp/i }),
      'Zezima',
    );
    await user.click(screen.getByRole('button', { name: 'Look up' }));

    expect(await screen.findByDisplayValue('737627')).toBeInTheDocument();
  });

  /** Not being on the hiscores is normal for a new account, not a failure. */
  it('states plainly when a player is not on the hiscores', async () => {
    const user = userEvent.setup();
    fetchStub.mockResolvedValue(jsonResponse({ status: 'not-found', rsn: 'nobody' }));
    render(<XpCalculator />);

    await user.type(
      screen.getByRole('textbox', { name: /look up current xp/i }),
      'nobody',
    );
    await user.click(screen.getByRole('button', { name: 'Look up' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no hiscores entry/i);
  });

  it('explains a rate-limited lookup without losing the rest of the form', async () => {
    const user = userEvent.setup();
    fetchStub.mockResolvedValue(jsonResponse({ error: 'Too many requests' }, 429));
    render(<XpCalculator />);

    await user.type(
      screen.getByRole('textbox', { name: /look up current xp/i }),
      'zezima',
    );
    await user.click(screen.getByRole('button', { name: 'Look up' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/too many lookups/i);
    expect(screen.getByRole('textbox', { name: CURRENT })).toBeEnabled();
  });

  it('tells the user to type it manually when the lookup fails outright', async () => {
    const user = userEvent.setup();
    fetchStub.mockRejectedValue(new Error('offline'));
    render(<XpCalculator />);

    await user.type(
      screen.getByRole('textbox', { name: /look up current xp/i }),
      'zezima',
    );
    await user.click(screen.getByRole('button', { name: 'Look up' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /type your xp in manually/i,
    );
  });

  /**
   * The lookup is a convenience, not a step. It must be impossible to get
   * "stuck" behind it, so it never fires on an empty name.
   */
  it('cannot be triggered with an empty name and makes no request', async () => {
    render(<XpCalculator />);

    expect(screen.getByRole('button', { name: 'Look up' })).toBeDisabled();
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it('works fully with no network at all', async () => {
    const user = userEvent.setup();
    render(<XpCalculator />);

    await user.type(screen.getByRole('textbox', { name: CURRENT }), '737627');

    expect(screen.getByText('12,296,804')).toBeInTheDocument();
    expect(fetchStub).not.toHaveBeenCalled();
  });
});
