import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClueSolver } from './ClueSolver';
import { clueCoverage } from '@/lib/clues/coverage';

/**
 * The solver renders against the real shipped dataset rather than a fixture.
 *
 * That is deliberate. The matching rules are already tested exhaustively in
 * `lib/clues/search.test.ts` with fixtures; what is left to check here is that
 * the component wires a real query to a real answer, and — most importantly —
 * that a miss reads as "we have not catalogued this" rather than "no such
 * clue". The empty state carries product meaning in this feature, so it gets
 * asserted on its words, not just its existence.
 */
const coverage = clueCoverage();

function renderSolver() {
  render(<ClueSolver coverage={coverage} />);
  return {
    user: userEvent.setup(),
    search: screen.getByRole('textbox', { name: /clue text, anagram or cipher/i }),
    filter: screen.getByRole('combobox', { name: /clue type/i }),
  };
}

describe('ClueSolver', () => {
  it('prompts before anything is typed instead of showing an empty result list', () => {
    renderSolver();

    expect(screen.getByText(/type any part of a clue/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /not in our dataset/i })).toBeNull();
  });

  it('solves an anagram typed exactly as the scroll writes it', async () => {
    const { user, search } = renderSolver();

    await user.type(search, 'PEATY PERT');

    expect(screen.getByRole('heading', { name: /anagram solved/i })).toBeInTheDocument();
    expect(screen.getAllByText('Party Pete').length).toBeGreaterThan(0);
  });

  it('solves the same anagram in lower case and without the clue’s spacing', async () => {
    const { user, search } = renderSolver();

    await user.type(search, 'peatypert');

    expect(screen.getByRole('heading', { name: /anagram solved/i })).toBeInTheDocument();
  });

  it('finds a catalogued step from a fragment of its text', async () => {
    const { user, search } = renderSolver();

    await user.type(search, 'rusty anchor');

    expect(
      screen.getByRole('heading', { name: /catalogued steps/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Rusty Anchor is in the north of Port Sarim/i),
    ).toBeInTheDocument();
  });

  it('decodes a cipher whose plaintext is in the name index', async () => {
    const { user, search } = renderSolver();

    // "Bartender" rotated forward by three.
    await user.type(search, 'Eduwhqghu');

    expect(screen.getByRole('heading', { name: /cipher decoded/i })).toBeInTheDocument();
    expect(screen.getByText('Bartender')).toBeInTheDocument();
  });

  it('states a miss as a gap in OUR dataset, not as a non-existent clue', async () => {
    const { user, search } = renderSolver();

    await user.type(search, 'qqqqqqqqzz');

    const heading = screen.getByRole('heading', { name: /not in our dataset/i });
    expect(heading).toBeInTheDocument();
    // The distinction the whole feature rests on: a miss must not read as an
    // authoritative "there is no such clue".
    expect(screen.getByText(/not a sign the clue does not exist/i)).toBeInTheDocument();
    // And it must quantify itself, so the member can judge how much to trust it.
    expect(screen.getByText(String(coverage.totalSteps))).toBeInTheDocument();
  });

  it('offers the Wiki as the fallback when it has nothing', async () => {
    const { user, search } = renderSolver();

    await user.type(search, 'qqqqqqqqzz');

    expect(
      screen.getByRole('link', { name: /search the osrs wiki for it/i }),
    ).toBeInTheDocument();
  });

  it('says outright that a type with no data has no data', async () => {
    const { user, filter } = renderSolver();

    await user.selectOptions(filter, 'emote');

    expect(screen.getByText(/we have no emote steps at all yet/i)).toBeInTheDocument();
  });

  it('does not surface an anagram answer while a different type is selected', async () => {
    // A result the active filter excludes reads as a bug even when it is right.
    const { user, search, filter } = renderSolver();

    await user.selectOptions(filter, 'cryptic');
    await user.type(search, 'PEATY PERT');

    expect(screen.queryByRole('heading', { name: /anagram solved/i })).toBeNull();
  });

  it('clears results when the query is emptied again', async () => {
    const { user, search } = renderSolver();

    await user.type(search, 'PEATY PERT');
    await user.clear(search);

    expect(screen.queryByRole('heading', { name: /anagram solved/i })).toBeNull();
    expect(screen.getByText(/type any part of a clue/i)).toBeInTheDocument();
  });
});
