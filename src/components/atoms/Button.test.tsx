import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

/**
 * REFERENCE UI TEST — copy this shape for component tests.
 *
 * What is worth testing in a presentational component is behaviour a user or a
 * screen reader can observe: accessible name, role, disabled state, what a click
 * does. Asserting on Tailwind class strings is not a test, it is a copy of the
 * implementation that fails on every restyle; the one exception below is the
 * `type` default, which is a real browser behaviour with a real bug attached.
 */
describe('Button', () => {
  it('renders its children as the accessible name', () => {
    render(<Button>Calculate</Button>);

    expect(screen.getByRole('button', { name: 'Calculate' })).toBeInTheDocument();
  });

  // A <button> inside a <form> defaults to type="submit", so a "Clear" button
  // that only meant to reset local state would submit and reload the page.
  // Defaulting to "button" is the whole reason the prop is defaulted at all.
  it('defaults to type="button" so it cannot accidentally submit a form', () => {
    render(<Button>Clear</Button>);

    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('still allows an explicit submit button', () => {
    render(<Button type="submit">Submit</Button>);

    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('calls onClick when activated', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Go</Button>);

    await user.click(screen.getByRole('button', { name: 'Go' }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not fire onClick while disabled', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button disabled onClick={onClick}>
        Go
      </Button>,
    );

    await user.click(screen.getByRole('button', { name: 'Go' }));

    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
