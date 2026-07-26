import { describe, expect, it } from 'vitest';
import { isLocalPostgres } from './index';

/**
 * The driver choice is worth testing precisely because getting it wrong is
 * silent. Picking node-postgres for a managed database does not error — it
 * works fine until concurrency exhausts `max_connections`, which happens in
 * production and never locally. So the assertions that matter most are the
 * negative ones: hosted providers must NOT be treated as local.
 */
describe('isLocalPostgres', () => {
  it.each([
    ['postgresql://osrs:localdev@localhost:5432/osrs', 'localhost'],
    ['postgresql://osrs:localdev@127.0.0.1:5432/osrs', 'IPv4 loopback'],
    ['postgresql://osrs:localdev@[::1]:5432/osrs', 'IPv6 loopback'],
  ])('treats %s as local (%s)', (url) => {
    expect(isLocalPostgres(url)).toBe(true);
  });

  it.each([
    ['postgresql://u:p@ep-x-pooler.eu-west-2.aws.neon.tech/db?sslmode=require', 'Neon'],
    ['postgresql://u:p@db.abcdefgh.supabase.co:5432/postgres', 'Supabase'],
    ['postgresql://u:p@mydb.abc123.eu-west-2.rds.amazonaws.com:5432/db', 'RDS'],
  ])('treats %s as remote (%s)', (url) => {
    expect(isLocalPostgres(url)).toBe(false);
  });

  // A hostname merely *containing* "localhost" is a different host entirely,
  // and an attacker-registered one at that. Substring matching here would send
  // production traffic down the local path.
  it('does not match a hostname that merely contains "localhost"', () => {
    expect(isLocalPostgres('postgresql://u:p@localhost.evil.com:5432/db')).toBe(false);
    expect(isLocalPostgres('postgresql://u:p@notlocalhost:5432/db')).toBe(false);
  });

  // Fail toward the serverless driver: it is correct everywhere we deploy, and
  // an unparseable URL is going to fail at connection time regardless.
  it('treats an unparseable URL as remote rather than throwing', () => {
    expect(isLocalPostgres('not a url')).toBe(false);
    expect(isLocalPostgres('')).toBe(false);
  });
});
