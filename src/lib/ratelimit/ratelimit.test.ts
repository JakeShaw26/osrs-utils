import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetEnvCache } from '@/lib/env';
import { createMemoryRateLimitStore } from './memory-store';
import { decide, windowStartFor, type RateLimitRule } from './types';
import {
  enforceRateLimit,
  rateLimitHeaders,
  setRateLimitStore,
  tooManyRequests,
} from './index';

const RULE: RateLimitRule = { limit: 3, windowSeconds: 60 };

describe('windowStartFor', () => {
  it('snaps to the window boundary', () => {
    const at = new Date('2026-07-26T10:00:37.500Z');

    expect(windowStartFor(at, 60).toISOString()).toBe('2026-07-26T10:00:00.000Z');
  });

  it('gives every instance the same boundary for the same instant', () => {
    // This is the property that lets separate serverless invocations increment
    // the same row without coordinating.
    const a = windowStartFor(new Date('2026-07-26T10:00:01Z'), 60);
    const b = windowStartFor(new Date('2026-07-26T10:00:59Z'), 60);

    expect(a.getTime()).toBe(b.getTime());
  });
});

describe('decide', () => {
  const windowStart = new Date('2026-07-26T10:00:00Z');
  const now = new Date('2026-07-26T10:00:30Z');

  it('allows the request that exactly reaches the limit', () => {
    // Off-by-one here means advertising "3 per minute" and serving 2.
    expect(decide({ hits: 3, windowStart }, RULE, now).allowed).toBe(true);
    expect(decide({ hits: 4, windowStart }, RULE, now).allowed).toBe(false);
  });

  it('reports remaining budget, floored at zero', () => {
    expect(decide({ hits: 1, windowStart }, RULE, now).remaining).toBe(2);
    expect(decide({ hits: 50, windowStart }, RULE, now).remaining).toBe(0);
  });

  it('counts retry-after to the end of the window, never below one second', () => {
    expect(decide({ hits: 4, windowStart }, RULE, now).retryAfterSeconds).toBe(30);

    const atBoundary = new Date('2026-07-26T10:00:59.900Z');
    expect(decide({ hits: 4, windowStart }, RULE, atBoundary).retryAfterSeconds).toBe(1);
  });
});

describe('enforceRateLimit', () => {
  const store = createMemoryRateLimitStore();

  function request(forwardedFor: string): Request {
    return new Request('https://example.test/api/thing', {
      headers: { 'x-forwarded-for': forwardedFor },
    });
  }

  beforeEach(() => {
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/db';
    process.env.WOM_GROUP_ID = '25092';
    process.env.CRON_SECRET = 'test-cron-secret-value';
    process.env.OSRS_API_USER_AGENT = 'osrs-clan-toolkit test (+contact)';
    resetEnvCache();

    store.reset();
    setRateLimitStore(store);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('allows up to the limit, then refuses', async () => {
    const results = [];
    for (let i = 0; i < 4; i++) {
      results.push(
        await enforceRateLimit(request('203.0.113.9'), { scope: 'lookup', rule: RULE }),
      );
    }

    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results.map((r) => r.remaining)).toEqual([2, 1, 0, 0]);
  });

  it('gives each caller their own budget', async () => {
    for (let i = 0; i < 3; i++) {
      await enforceRateLimit(request('203.0.113.9'), { scope: 'lookup', rule: RULE });
    }

    const other = await enforceRateLimit(request('198.51.100.7'), {
      scope: 'lookup',
      rule: RULE,
    });

    expect(other.allowed).toBe(true);
    expect(other.remaining).toBe(2);
  });

  it('cannot be bypassed by forging X-Forwarded-For', async () => {
    // The attack: a fresh spoofed address on every request, hoping for a fresh
    // bucket each time. Only the entry our proxy appended is read, so all four
    // land in the same bucket and the fourth is refused.
    const spoofs = ['1.1.1.1', '2.2.2.2', '3.3.3.3', '4.4.4.4'];

    const results = [];
    for (const spoof of spoofs) {
      results.push(
        await enforceRateLimit(request(`${spoof}, 203.0.113.9`), {
          scope: 'lookup',
          rule: RULE,
        }),
      );
    }

    expect(results.at(-1)?.allowed).toBe(false);
  });

  it('keeps scopes independent', async () => {
    for (let i = 0; i < 4; i++) {
      await enforceRateLimit(request('203.0.113.9'), { scope: 'lookup', rule: RULE });
    }

    const other = await enforceRateLimit(request('203.0.113.9'), {
      scope: 'prices',
      rule: RULE,
    });

    expect(other.allowed).toBe(true);
  });

  it('rolls over when the window closes', async () => {
    const first = new Date('2026-07-26T10:00:30Z');
    const next = new Date('2026-07-26T10:01:05Z');

    for (let i = 0; i < 4; i++) {
      await enforceRateLimit(request('203.0.113.9'), {
        scope: 'lookup',
        rule: RULE,
        now: first,
      });
    }

    const after = await enforceRateLimit(request('203.0.113.9'), {
      scope: 'lookup',
      rule: RULE,
      now: next,
    });

    expect(after.allowed).toBe(true);
    expect(after.remaining).toBe(2);
  });

  it('fails open and flags itself when the store is down', async () => {
    // A database blip must not take the whole public app offline. The request
    // is allowed, but `degraded` distinguishes "under the limit" from "not
    // limiting at all" — otherwise a dead limiter looks like a healthy one.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setRateLimitStore({
      name: 'broken',
      increment: () => Promise.reject(new Error('connection refused')),
    });

    const decision = await enforceRateLimit(request('203.0.113.9'), {
      scope: 'lookup',
      rule: RULE,
    });

    expect(decision.allowed).toBe(true);
    expect(decision.degraded).toBe(true);
  });
});

describe('response helpers', () => {
  const denied = decide(
    { hits: 9, windowStart: new Date('2026-07-26T10:00:00Z') },
    RULE,
    new Date('2026-07-26T10:00:30Z'),
  );

  it('sets Retry-After only when the caller is actually blocked', () => {
    const allowed = decide(
      { hits: 1, windowStart: new Date('2026-07-26T10:00:00Z') },
      RULE,
      new Date('2026-07-26T10:00:30Z'),
    );

    expect(rateLimitHeaders(denied)['Retry-After']).toBe('30');
    expect(rateLimitHeaders(allowed)['Retry-After']).toBeUndefined();
  });

  it('returns a 429 that is never cached', async () => {
    // A cached 429 would be served to innocent visitors from the edge long
    // after the offender stopped.
    const response = tooManyRequests(denied);

    expect(response.status).toBe(429);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toMatchObject({ retryAfterSeconds: 30 });
  });
});
