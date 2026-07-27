import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgilityCourseComparator } from './AgilityCourseComparator';
import type { AgilityCourse } from '@/lib/skilling/types';

const COURSES: AgilityCourse[] = [
  {
    id: 'canifis',
    name: 'Canifis',
    minLevel: 40,
    xpPerLap: 240,
    xpPerHour: { low: 14_000, high: 17_000 },
    marksPerHour: { low: 12.8, high: 15.5 },
    recommendedTo: 50,
  },
  {
    id: 'seers-village',
    name: "Seers' Village",
    minLevel: 60,
    xpPerLap: 570,
    xpPerHour: { low: 40_000, high: 60_000 },
    marksPerHour: { low: 10, high: 20 },
    recommendedTo: 70,
    note: 'Faster with the Kandarin Hard diary.',
  },
];

describe('AgilityCourseComparator', () => {
  it('lists every course with its rates before any goal is entered', () => {
    render(<AgilityCourseComparator courses={COURSES} />);

    expect(screen.getByText('Canifis')).toBeInTheDocument();
    expect(screen.getByText("Seers' Village")).toBeInTheDocument();
    expect(screen.getByText(/enter your current xp and a target/i)).toBeInTheDocument();
  });

  /**
   * Rates are ranges, not midpoints. Publishing 50,000 as if it were the answer
   * when the real figure is 40,000–60,000 depending on a diary is exactly the
   * false precision PRD §3.3 warns about.
   */
  it('shows xp/hr and marks/hr as ranges rather than a single figure', () => {
    render(<AgilityCourseComparator courses={COURSES} />);

    const row = screen.getByRole('row', { name: /Seers' Village/ });
    expect(within(row).getByText('40,000–60,000')).toBeInTheDocument();
    expect(within(row).getByText('10–20')).toBeInTheDocument();
  });

  it('computes laps, hours and marks for a goal', async () => {
    const user = userEvent.setup();
    render(<AgilityCourseComparator courses={COURSES} />);

    // 120,000 XP remaining.
    await user.type(
      screen.getByRole('textbox', { name: 'Current Agility XP' }),
      '12914431',
    );

    const row = screen.getByRole('row', { name: /Seers' Village/ });
    expect(within(row).getByText('211')).toBeInTheDocument(); // ceil(120000/570)
    expect(within(row).getByText('2.0–3.0')).toBeInTheDocument();
  });

  it('marks the course the player should be on', async () => {
    const user = userEvent.setup();
    render(<AgilityCourseComparator courses={COURSES} />);

    // XP for level 61.
    await user.type(
      screen.getByRole('textbox', { name: 'Current Agility XP' }),
      '302288',
    );

    const row = screen.getByRole('row', { name: /Seers' Village/ });
    expect(within(row).getByText(/best for you/i)).toBeInTheDocument();
  });

  it('reads back the level for a typed XP total', async () => {
    const user = userEvent.setup();
    render(<AgilityCourseComparator courses={COURSES} />);

    await user.type(
      screen.getByRole('textbox', { name: 'Current Agility XP' }),
      '737627',
    );

    expect(screen.getByText('lvl 70')).toBeInTheDocument();
  });

  it('accepts shorthand without producing NaN', async () => {
    const user = userEvent.setup();
    render(<AgilityCourseComparator courses={COURSES} />);

    await user.type(screen.getByRole('textbox', { name: 'Current Agility XP' }), '1m');

    expect(screen.queryByText(/nan/i)).not.toBeInTheDocument();
    expect(screen.getByText('lvl 73')).toBeInTheDocument();
  });

  it('shows an error for input it cannot read', async () => {
    const user = userEvent.setup();
    render(<AgilityCourseComparator courses={COURSES} />);

    await user.type(
      screen.getByRole('textbox', { name: 'Current Agility XP' }),
      'plenty',
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/enter a number/i);
  });

  it('flags a target below the current XP', async () => {
    const user = userEvent.setup();
    render(<AgilityCourseComparator courses={COURSES} />);

    await user.type(screen.getByRole('textbox', { name: 'Current Agility XP' }), '13m');
    await user.clear(screen.getByRole('textbox', { name: 'Target level' }));
    await user.type(screen.getByRole('textbox', { name: 'Target level' }), '50');

    expect(screen.getByRole('alert')).toHaveTextContent(/below your current xp/i);
  });

  it('states an empty table rather than rendering nothing', () => {
    render(<AgilityCourseComparator courses={[]} />);

    expect(screen.getByText(/no courses are configured/i)).toBeInTheDocument();
  });
});
