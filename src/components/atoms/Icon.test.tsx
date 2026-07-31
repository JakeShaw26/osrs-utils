import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Icon, ICON_NAMES } from './Icon';

describe('Icon', () => {
  it('names itself for assistive tech when it carries meaning', () => {
    render(<Icon name="alert" title="Warning" />);

    expect(screen.getByRole('img', { name: 'Warning' })).toBeInTheDocument();
  });

  it('is hidden when a visible label already says the same word', () => {
    const { container } = render(<Icon name="search" />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  /**
   * The whole distinction between the two icon tiers: a glyph follows
   * `currentColor`, so it can carry state through colour and inverts with the
   * theme. A sprite cannot. If this ever stops being true, glyphs and sprites
   * become interchangeable and the system quietly collapses into one tier.
   */
  it('inherits the surrounding text colour', () => {
    const { container } = render(<Icon name="check" />);

    expect(container.querySelector('svg')).toHaveClass('fill-current');
  });

  it('draws every declared name', () => {
    for (const name of ICON_NAMES) {
      const { container } = render(<Icon name={name} />);
      expect(container.querySelectorAll('path').length).toBeGreaterThan(0);
    }
  });

  it('renders on the 16-grid so it sits with the sprites', () => {
    const { container } = render(<Icon name="filter" size={20} />);
    const svg = container.querySelector('svg');

    expect(svg).toHaveAttribute('viewBox', '0 0 16 16');
    expect(svg).toHaveAttribute('width', '20');
  });
});
