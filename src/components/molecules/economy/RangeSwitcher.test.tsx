import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RangeSwitcher } from './RangeSwitcher';

describe('RangeSwitcher', () => {
  it('offers exactly the four ranges the API can serve', () => {
    render(<RangeSwitcher basePath="/economy/items/4151" active="15d" />);

    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      '2 days',
      '15 days',
      '90 days',
      '1 year',
    ]);
  });

  // No "all time": the data does not exist beyond ~1 year (ADR-0003).
  it('offers no all-time or multi-year option', () => {
    render(<RangeSwitcher basePath="/economy/items/4151" active="15d" />);

    expect(screen.queryByRole('link', { name: /all.?time/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /year/i })).toHaveTextContent('1 year');
  });

  // Links rather than buttons: each range is a real, cacheable URL and the
  // switcher works with no JavaScript.
  it('links to a URL per range so it works without JavaScript', () => {
    render(<RangeSwitcher basePath="/economy/items/4151" active="15d" />);

    expect(screen.getByRole('link', { name: '90 days' })).toHaveAttribute(
      'href',
      '/economy/items/4151?range=90d',
    );
  });

  it('marks the active range for assistive tech, not just visually', () => {
    render(<RangeSwitcher basePath="/economy/items/4151" active="90d" />);

    expect(screen.getByRole('link', { name: '90 days' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: '2 days' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('preserves other query params when switching range', () => {
    render(
      <RangeSwitcher
        basePath="/economy/items/4151"
        active="2d"
        extraParams={{ q: 'whip' }}
      />,
    );

    expect(screen.getByRole('link', { name: '1 year' })).toHaveAttribute(
      'href',
      '/economy/items/4151?q=whip&range=1y',
    );
  });

  it('is labelled as navigation for the price range', () => {
    render(<RangeSwitcher basePath="/economy/items/4151" active="2d" />);

    expect(
      screen.getByRole('navigation', { name: 'Price history range' }),
    ).toBeInTheDocument();
  });
});
