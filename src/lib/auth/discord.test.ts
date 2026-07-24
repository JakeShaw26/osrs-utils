import { describe, it, expect } from 'vitest';
import { interpretMemberResponse } from './discord';
import type { RoleMapping } from './tiers';

/**
 * Status-code mapping is where the fail-closed model can be defeated from
 * underneath: classify a transient error as "not a member" and we log the clan
 * out; classify a missing membership as transient and a kicked officer keeps
 * access. Each status is pinned deliberately.
 */

const MAPPING: RoleMapping = { '111': 'member', '222': 'officer' };
const member = (roles: string[]) => ({ roles, nick: null, joined_at: '2024-01-01' });

describe('interpretMemberResponse — success', () => {
  it('resolves the tier from returned roles', () => {
    expect(interpretMemberResponse(200, member(['222']), MAPPING)).toEqual({
      status: 'ok',
      tier: 'officer',
    });
  });

  it('resolves to guest when the user holds no mapped roles', () => {
    // A real answer of "no roles" is legitimate — guest, not an error.
    expect(interpretMemberResponse(200, member([]), MAPPING)).toEqual({
      status: 'ok',
      tier: 'guest',
    });
  });
});

describe('interpretMemberResponse — authoritative absence', () => {
  it('treats 404 as not_member', () => {
    // The only status that proves absence, and the only one that revokes.
    expect(interpretMemberResponse(404, null, MAPPING)).toEqual({ status: 'not_member' });
  });
});

describe('interpretMemberResponse — transient, must NOT revoke', () => {
  it.each([
    [401, 'expired token'],
    [403, 'missing scope / app access'],
    [429, 'rate limited'],
    [500, 'discord broken'],
    [503, 'discord down'],
    [418, 'unexpected'],
  ])('treats %i (%s) as unavailable', (status) => {
    const result = interpretMemberResponse(status, null, MAPPING);
    expect(result.status).toBe('unavailable');
  });

  it('does NOT treat 403 as not_member', () => {
    // If it did, one scope misconfiguration would revoke every session in the
    // clan at once — an outage turned into a mass de-link.
    expect(interpretMemberResponse(403, null, MAPPING).status).not.toBe('not_member');
  });

  it('does NOT treat 401 as not_member', () => {
    // An expired token says nothing about guild membership; refresh first.
    expect(interpretMemberResponse(401, null, MAPPING).status).not.toBe('not_member');
  });
});

describe('interpretMemberResponse — malformed payloads', () => {
  it.each([
    ['null body', null],
    ['no roles key', { nick: 'x' }],
    ['roles not an array', { roles: 'officer' }],
    ['roles containing non-strings', { roles: ['111', 42] }],
    ['a bare string', 'oops'],
  ])('treats %s as unavailable rather than guest', (_label, body) => {
    // Falling through to `guest` would look like a successful answer and
    // silently strip permissions — a confusing, hard-to-diagnose failure.
    expect(interpretMemberResponse(200, body, MAPPING).status).toBe('unavailable');
  });
});
