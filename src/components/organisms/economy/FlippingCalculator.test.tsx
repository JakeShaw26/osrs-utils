import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FlippingCalculator } from './FlippingCalculator';

/**
 * Reads one stat tile by its label.
 *
 * Several tiles legitimately show the same number — at quantity 1 the margin
 * per item and the total profit are identical — so a bare `getByText` is
 * ambiguous. `StatTile` renders `<dt>label</dt><dd>value</dd>`, so pairing them
 * asserts that the right tile holds the value rather than that the value
 * appears somewhere on the page.
 */
function statValue(label: string): string {
  const term = screen.getByText(label);
  return term.nextElementSibling?.textContent?.trim() ?? '';
}

/**
 * The maths is already tested in lib/economy/flipping.test.ts and
 * ge-tax.test.ts. What is worth testing here is the wiring the user touches:
 * that the fields are labelled, that typing recomputes, that shorthand and
 * pasted separators survive the round trip, and that bad input produces an
 * error rather than NaN on screen.
 */
describe('FlippingCalculator', () => {
  it('prompts for input before any prices are entered', () => {
    render(<FlippingCalculator />);

    expect(screen.getByText(/enter a buy and a sell price/i)).toBeInTheDocument();
  });

  it('labels every field so it is reachable by name', () => {
    render(<FlippingCalculator />);

    expect(screen.getByRole('textbox', { name: 'Buy price' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Sell price' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Quantity' })).toBeInTheDocument();
  });

  it('shows the margin after tax once both prices are entered', async () => {
    const user = userEvent.setup();
    render(<FlippingCalculator />);

    await user.type(screen.getByRole('textbox', { name: 'Buy price' }), '1000');
    await user.type(screen.getByRole('textbox', { name: 'Sell price' }), '1200');

    // 1,200 - 1,000 - 24 tax = 176
    expect(statValue('Margin per item')).toBe('176 gp');
    expect(statValue('GE tax per item')).toBe('24 gp');
    expect(statValue('Return on investment')).toBe('17.60%');
  });

  it('multiplies out the total for a quantity', async () => {
    const user = userEvent.setup();
    render(<FlippingCalculator />);

    await user.type(screen.getByRole('textbox', { name: 'Buy price' }), '1000');
    await user.type(screen.getByRole('textbox', { name: 'Sell price' }), '1200');
    await user.clear(screen.getByRole('textbox', { name: 'Quantity' }));
    await user.type(screen.getByRole('textbox', { name: 'Quantity' }), '1000');

    // 176 * 1,000 = 176,000 -> "176k"
    expect(statValue('Total profit')).toBe('176k gp');
    expect(statValue('Margin per item')).toBe('176 gp');
  });

  // The specific failure the text inputs exist to prevent.
  it('accepts the k/m shorthand players type', async () => {
    const user = userEvent.setup();
    render(<FlippingCalculator />);

    await user.type(screen.getByRole('textbox', { name: 'Buy price' }), '1k');
    await user.type(screen.getByRole('textbox', { name: 'Sell price' }), '1.2k');

    expect(statValue('Margin per item')).toBe('176 gp');
  });

  it('accepts pasted thousands separators', async () => {
    const user = userEvent.setup();
    render(<FlippingCalculator />);

    await user.type(screen.getByRole('textbox', { name: 'Buy price' }), '1,000');
    await user.type(screen.getByRole('textbox', { name: 'Sell price' }), '1,200');

    expect(statValue('Margin per item')).toBe('176 gp');
  });

  it('reports an error for unreadable input instead of showing NaN', async () => {
    const user = userEvent.setup();
    render(<FlippingCalculator />);

    await user.type(screen.getByRole('textbox', { name: 'Buy price' }), 'abc');

    expect(screen.getByRole('alert')).toHaveTextContent(/enter a number/i);
    expect(screen.getByRole('textbox', { name: 'Buy price' })).toBeInvalid();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it('does not mark an empty field as invalid', () => {
    render(<FlippingCalculator />);

    expect(screen.getByRole('textbox', { name: 'Buy price' })).not.toBeInvalid();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // The case a flipper most needs warning about: the trade looks profitable
  // until the tax lands.
  it('states plainly when the tax is what turns a flip into a loss', async () => {
    const user = userEvent.setup();
    render(<FlippingCalculator />);

    await user.type(screen.getByRole('textbox', { name: 'Buy price' }), '1000');
    await user.type(screen.getByRole('textbox', { name: 'Sell price' }), '1010');

    expect(screen.getByRole('status')).toHaveTextContent(
      /the tax is what makes it a loss/i,
    );
  });

  it('says so when the sell price is simply below the buy price', async () => {
    const user = userEvent.setup();
    render(<FlippingCalculator />);

    await user.type(screen.getByRole('textbox', { name: 'Buy price' }), '5000');
    await user.type(screen.getByRole('textbox', { name: 'Sell price' }), '1000');

    expect(screen.getByRole('status')).toHaveTextContent(
      /sell price is below the buy price/i,
    );
  });

  it('charges no tax on an exempt item', async () => {
    const user = userEvent.setup();
    render(<FlippingCalculator initialItemName="Ring of dueling(8)" />);

    await user.type(screen.getByRole('textbox', { name: 'Buy price' }), '1000');
    await user.type(screen.getByRole('textbox', { name: 'Sell price' }), '1200');

    expect(screen.getByText(/exempt item/i)).toBeInTheDocument();
    expect(statValue('GE tax per item')).toBe('0 gp');
    // The full gross margin survives, because nothing is deducted.
    expect(statValue('Margin per item')).toBe('200 gp');
  });

  it('prefills from live prices when given them', () => {
    render(
      <FlippingCalculator
        initialItemName="Abyssal whip"
        initialBuyPrice={1_500_000}
        initialSellPrice={1_600_000}
        initialQuantity={70}
      />,
    );

    expect(screen.getByRole('textbox', { name: 'Buy price' })).toHaveValue('1500000');
    expect(screen.getByRole('textbox', { name: 'Quantity' })).toHaveValue('70');
  });

  // The PRD calls showing margin without volume "the most common flaw in
  // flipping tools", so the warning must be present even with no data.
  it('always shows a liquidity verdict, including when volume is unknown', () => {
    render(<FlippingCalculator volume={null} />);

    expect(screen.getByText('No volume data')).toBeInTheDocument();
  });

  it('warns that a fat margin on a dead item is a trap', () => {
    render(<FlippingCalculator volume={{ highPriceVolume: 0, lowPriceVolume: 0 }} />);

    expect(screen.getByText('Illiquid')).toBeInTheDocument();
    expect(screen.getByText(/nobody is buying/i)).toBeInTheDocument();
  });

  it('reports an active market without a warning', () => {
    render(<FlippingCalculator volume={{ highPriceVolume: 500, lowPriceVolume: 500 }} />);

    expect(screen.getByText('Active')).toBeInTheDocument();
  });
});
