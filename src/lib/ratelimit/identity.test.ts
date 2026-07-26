import { describe, expect, it } from 'vitest';
import { bucketKeyFor, clientIpFrom } from './identity';

/**
 * These tests are the ones that matter most in this module. A limiter with a
 * broken counter fails loudly; a limiter with a spoofable identity passes every
 * happy-path test while enforcing nothing.
 */

function headers(values: Record<string, string>): Headers {
  return new Headers(values);
}

describe('clientIpFrom', () => {
  it('reads the entry our own proxy appended, not the one the client sent', () => {
    // The attacker sent "1.1.1.1"; our proxy appended their real address.
    // Reading the leftmost entry — the common mistake — would hand them a
    // fresh, self-chosen bucket on every request.
    const ip = clientIpFrom(headers({ 'x-forwarded-for': '1.1.1.1, 203.0.113.9' }), 1);

    expect(ip).toBe('203.0.113.9');
  });

  it('gives a spoofing client the same bucket no matter what they claim', () => {
    const spoofed = ['9.9.9.9', 'not-an-ip', ''].map((claim) =>
      clientIpFrom(headers({ 'x-forwarded-for': `${claim}, 203.0.113.9` }), 1),
    );

    expect(new Set(spoofed)).toEqual(new Set(['203.0.113.9']));
  });

  it('steps back one entry per trusted proxy hop', () => {
    const value = 'spoof, 198.51.100.4, 10.0.0.1';

    expect(clientIpFrom(headers({ 'x-forwarded-for': value }), 1)).toBe('10.0.0.1');
    expect(clientIpFrom(headers({ 'x-forwarded-for': value }), 2)).toBe('198.51.100.4');
  });

  it('trusts nothing when the header is shorter than the configured topology', () => {
    // Fewer appenders than expected means the header did not come from the
    // proxies we assumed, so no entry in it is trustworthy.
    expect(clientIpFrom(headers({ 'x-forwarded-for': '203.0.113.9' }), 2)).toBeNull();
  });

  it('tolerates whitespace and empty entries', () => {
    expect(clientIpFrom(headers({ 'x-forwarded-for': ' ,  203.0.113.9  ' }), 1)).toBe(
      '203.0.113.9',
    );
  });

  it('falls back to x-real-ip only when there is no forwarded-for list', () => {
    expect(clientIpFrom(headers({ 'x-real-ip': '203.0.113.5' }))).toBe('203.0.113.5');

    // X-Forwarded-For wins: mixing the two lets a client supply x-real-ip and
    // override the value our proxy appended.
    expect(
      clientIpFrom(
        headers({ 'x-forwarded-for': '203.0.113.9', 'x-real-ip': '1.2.3.4' }),
        1,
      ),
    ).toBe('203.0.113.9');
  });

  it('returns null when no proxy header is present', () => {
    expect(clientIpFrom(headers({}))).toBeNull();
  });
});

describe('bucketKeyFor', () => {
  const salt = 'test-salt-at-least-16-chars';

  it('is stable for the same caller', () => {
    expect(bucketKeyFor('lookup', '203.0.113.9', salt)).toBe(
      bucketKeyFor('lookup', '203.0.113.9', salt),
    );
  });

  it('separates scopes, so exhausting one budget does not exhaust another', () => {
    expect(bucketKeyFor('lookup', '203.0.113.9', salt)).not.toBe(
      bucketKeyFor('prices', '203.0.113.9', salt),
    );
  });

  it('separates callers', () => {
    expect(bucketKeyFor('lookup', '203.0.113.9', salt)).not.toBe(
      bucketKeyFor('lookup', '203.0.113.10', salt),
    );
  });

  it('does not leak the address it was derived from', () => {
    // The stored key is what a database dump would expose. IPv4 is small
    // enough to brute-force from an unsalted digest, hence the salt.
    const key = bucketKeyFor('lookup', '203.0.113.9', salt);

    expect(key).not.toContain('203.0.113.9');
    expect(bucketKeyFor('lookup', '203.0.113.9', 'a-different-salt')).not.toBe(key);
  });
});
