import { describe, it, expect } from 'vitest';
import {
  meetsTier,
  resolveTier,
  isPrivilegedTier,
  isClanTier,
  DEFAULT_TIER,
  type RoleMapping,
} from './tiers';

/**
 * These tests verify that role resolution cannot accidentally grant access.
 * Every case below is a way the mapping could go wrong in production —
 * Discord reordering the roles array, a role being deleted, config drifting.
 */

const MAPPING: RoleMapping = {
  '111': 'member',
  '222': 'officer',
  '333': 'admin',
  '444': 'applicant',
};

describe('meetsTier', () => {
  it('allows an exact match', () => {
    expect(meetsTier('officer', 'officer')).toBe(true);
  });

  it('allows a higher tier to satisfy a lower requirement', () => {
    expect(meetsTier('admin', 'member')).toBe(true);
  });

  it('refuses a lower tier', () => {
    // The core check: a member must never pass an officer gate.
    expect(meetsTier('member', 'officer')).toBe(false);
    expect(meetsTier('guest', 'applicant')).toBe(false);
  });
});

describe('isPrivilegedTier', () => {
  it('treats officer and above as privileged', () => {
    expect(isPrivilegedTier('officer')).toBe(true);
    expect(isPrivilegedTier('admin')).toBe(true);
  });

  it('does not treat member and below as privileged', () => {
    expect(isPrivilegedTier('member')).toBe(false);
    expect(isPrivilegedTier('guest')).toBe(false);
  });
});

describe('resolveTier', () => {
  it('maps a single known role', () => {
    expect(resolveTier(['111'], MAPPING)).toBe('member');
  });

  it('takes the HIGHEST tier when several roles map', () => {
    // Matters because Discord's role array order is not something we control.
    // Taking the first match would make the result order-dependent.
    expect(resolveTier(['111', '222'], MAPPING)).toBe('officer');
    expect(resolveTier(['222', '111'], MAPPING)).toBe('officer');
    expect(resolveTier(['111', '333', '222'], MAPPING)).toBe('admin');
  });

  it('ignores unmapped roles rather than inheriting from them', () => {
    // Adding a new Discord role must never grant access by itself.
    expect(resolveTier(['999', '111'], MAPPING)).toBe('member');
    expect(resolveTier(['999', '888'], MAPPING)).toBe(DEFAULT_TIER);
  });

  it('falls back to guest for an empty role list', () => {
    // A member with no roles is a guest, not an error and not a member.
    expect(resolveTier([], MAPPING)).toBe('guest');
  });

  it('falls back to guest when the mapping is empty', () => {
    // Unconfigured clan_config must fail closed, not open.
    expect(resolveTier(['111', '222'], {})).toBe('guest');
  });

  it('never returns a tier absent from the mapping', () => {
    // Guards against a future refactor inferring tiers from role names.
    const result = resolveTier(['444'], MAPPING);
    expect(result).toBe('applicant');
  });
});

describe('isClanTier', () => {
  it('accepts valid tiers', () => {
    expect(isClanTier('officer')).toBe(true);
  });

  it('rejects anything else', () => {
    // Values arriving from the database or config are untrusted.
    expect(isClanTier('superadmin')).toBe(false);
    expect(isClanTier('')).toBe(false);
    expect(isClanTier(null)).toBe(false);
    expect(isClanTier(undefined)).toBe(false);
    expect(isClanTier(4)).toBe(false);
  });
});
