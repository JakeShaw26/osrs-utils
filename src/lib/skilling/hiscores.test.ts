import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetEnvCache } from '@/lib/env';
import { lookupHiscores, normaliseRsn, xpForSkill } from './hiscores';

/**
 * `fetch` is stubbed, never called for real. CI runs with no secrets and the
 * self-limiting commitment in docs/api-terms.md rules out hitting Jagex from a
 * test suite.
 */

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('normaliseRsn', () => {
  it('accepts the characters a display name can contain', () => {
    expect(normaliseRsn('Zezima')).toBe('zezima');
    expect(normaliseRsn('Lynx Titan')).toBe('lynx_titan');
    expect(normaliseRsn('a-b_c 1')).toBe('a-b_c_1');
  });

  /**
   * Case folding is not cosmetic. `osrsFetch` caches per URL, so folding case
   * means "Zezima", "zezima" and "ZEZIMA" share ONE cache entry instead of
   * three — a third of the upstream requests for the same information.
   */
  it('folds case and spaces so variants share one cache entry', () => {
    expect(normaliseRsn('ZEZIMA')).toBe(normaliseRsn('zezima'));
    expect(normaliseRsn('Lynx Titan')).toBe(normaliseRsn('lynx_titan'));
  });

  it('trims surrounding whitespace', () => {
    expect(normaliseRsn('  Zezima  ')).toBe('zezima');
  });

  /**
   * SECURITY — this is a rate-limiting control, not just input hygiene.
   *
   * Without it an attacker sends a different junk name on every request, misses
   * the 5-minute cache every time, and turns our server into a load generator
   * pointed at Jagex from our IP (PRD §5.3).
   */
  it('rejects names longer than 12 characters', () => {
    expect(normaliseRsn('a'.repeat(12))).not.toBeNull();
    expect(normaliseRsn('a'.repeat(13))).toBeNull();
  });

  it('rejects an empty name and non-strings', () => {
    expect(normaliseRsn('')).toBeNull();
    expect(normaliseRsn('   ')).toBeNull();
    expect(normaliseRsn(null)).toBeNull();
    expect(normaliseRsn(undefined)).toBeNull();
  });

  it('rejects characters that could alter the upstream request', () => {
    expect(normaliseRsn('foo&bar=1')).toBeNull();
    expect(normaliseRsn('foo/bar')).toBeNull();
    expect(normaliseRsn('foo?bar')).toBeNull();
    expect(normaliseRsn('../../etc')).toBeNull();
    expect(normaliseRsn('<script>')).toBeNull();
    expect(normaliseRsn('foo#bar')).toBeNull();
  });
});

describe('lookupHiscores', () => {
  const fetchStub = vi.fn();

  beforeEach(() => {
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/db';
    process.env.WOM_GROUP_ID = '25092';
    process.env.CRON_SECRET = 'test-cron-secret-value';
    process.env.OSRS_API_USER_AGENT = 'osrs-clan-toolkit test (+contact)';
    resetEnvCache();

    fetchStub.mockReset();
    vi.stubGlobal('fetch', fetchStub);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns the player's skills", async () => {
    fetchStub.mockResolvedValue(
      jsonResponse({
        name: 'zezima',
        skills: [
          { id: 0, name: 'Overall', rank: 1, level: 2277, xp: 4_600_000_000 },
          { id: 17, name: 'Fletching', rank: 42, level: 99, xp: 13_034_431 },
        ],
      }),
    );

    const result = await lookupHiscores('zezima');

    expect(result.status).toBe('found');
    expect(xpForSkill(result, 'Fletching')).toBe(13_034_431);
  });

  it('requests index_lite.json with the player as a query parameter', async () => {
    fetchStub.mockResolvedValue(
      jsonResponse({ skills: [{ id: 1, name: 'Attack', rank: 1, level: 99, xp: 1 }] }),
    );

    await lookupHiscores('lynx_titan');

    const [url] = fetchStub.mock.calls.at(-1) as [string];
    const parsed = new URL(url);
    expect(parsed.pathname).toContain('/index_lite.json');
    expect(parsed.searchParams.get('player')).toBe('lynx_titan');
  });

  /**
   * Unranked skills come back as -1 across the board. Passing that through
   * would put "-1" in the XP calculator's current-XP box and compute a goal
   * from it.
   */
  it('normalises unranked -1 values to level 1 and 0 XP', async () => {
    fetchStub.mockResolvedValue(
      jsonResponse({
        skills: [{ id: 22, name: 'Construction', rank: -1, level: -1, xp: -1 }],
      }),
    );

    const result = await lookupHiscores('newbie');

    expect(result.status).toBe('found');
    expect(xpForSkill(result, 'Construction')).toBe(0);
    if (result.status === 'found') expect(result.skills[0]!.level).toBe(1);
  });

  /**
   * A player not being on the hiscores is a NORMAL state. Anyone new or
   * low-level simply is not listed, and dressing that up as an error makes the
   * commonest outcome for a new member look like a broken feature.
   */
  it('reports a 404 as not-found rather than an error', async () => {
    fetchStub.mockResolvedValue(new Response('', { status: 404 }));

    await expect(lookupHiscores('nobody')).resolves.toEqual({
      status: 'not-found',
      rsn: 'nobody',
    });
  });

  it('reports an empty skills array as not-found', async () => {
    fetchStub.mockResolvedValue(jsonResponse({ skills: [] }));

    expect((await lookupHiscores('nobody')).status).toBe('not-found');
  });

  /**
   * 403/429 is Jagex throttling US, not a statement about the player. Telling
   * someone their account does not exist because we got rate limited is a lie,
   * and it is the kind that generates support questions.
   */
  it.each([403, 429, 500, 503])(
    'reports HTTP %i as unavailable, not as not-found',
    async (status) => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      fetchStub.mockResolvedValue(new Response('', { status }));

      expect((await lookupHiscores('zezima')).status).toBe('unavailable');
    },
  );

  it('reports a network failure as unavailable rather than throwing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchStub.mockRejectedValue(new Error('ECONNRESET'));

    await expect(lookupHiscores('zezima')).resolves.toEqual({
      status: 'unavailable',
      rsn: 'zezima',
    });
  });
});

describe('xpForSkill', () => {
  it('is null unless the player was found', () => {
    expect(xpForSkill({ status: 'not-found', rsn: 'x' }, 'Attack')).toBeNull();
    expect(xpForSkill({ status: 'unavailable', rsn: 'x' }, 'Attack')).toBeNull();
  });

  it('matches the skill name case-insensitively', () => {
    const found = {
      status: 'found' as const,
      rsn: 'x',
      skills: [{ id: 1, name: 'Attack', rank: 1, level: 99, xp: 13_034_431 }],
    };

    expect(xpForSkill(found, 'attack')).toBe(13_034_431);
  });

  it('is null for a skill the player has no row for', () => {
    const found = { status: 'found' as const, rsn: 'x', skills: [] };

    expect(xpForSkill(found, 'Attack')).toBeNull();
  });
});
