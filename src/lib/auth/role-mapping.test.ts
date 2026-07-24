import { describe, it, expect } from 'vitest';
import { parseRoleMapping } from './role-mapping';
import { resolveTier } from './tiers';

/**
 * The role mapping arrives from a JSONB column — untrusted input that decides
 * who is an Officer. These tests pin that malformed config fails closed.
 */

describe('parseRoleMapping', () => {
  it('parses a valid mapping', () => {
    expect(parseRoleMapping({ '123': 'officer', '456': 'member' })).toEqual({
      '123': 'officer',
      '456': 'member',
    });
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an array', ['officer']],
    ['a string', 'officer'],
    ['a number', 42],
  ])('returns an empty mapping for %s', (_label, value) => {
    expect(parseRoleMapping(value)).toEqual({});
  });

  it('drops entries with an invalid tier, keeping valid ones', () => {
    // One bad row must not corrupt the whole mapping...
    const result = parseRoleMapping({ '123': 'superadmin', '456': 'member' });
    expect(result).toEqual({ '456': 'member' });
  });

  it('drops keys that are not Discord snowflakes', () => {
    expect(parseRoleMapping({ 'not-an-id': 'admin', '789': 'officer' })).toEqual({
      '789': 'officer',
    });
  });

  it('never invents a tier for an unparseable entry', () => {
    // ...and an entirely invalid mapping grants nothing.
    const mapping = parseRoleMapping({ '123': 'root', '456': null });
    expect(resolveTier(['123', '456'], mapping)).toBe('guest');
  });

  it('produces a mapping that denies by default when config is missing', () => {
    // The end-to-end property: no config means no access, not open access.
    expect(resolveTier(['123'], parseRoleMapping(undefined))).toBe('guest');
  });
});
