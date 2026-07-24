#!/usr/bin/env node
/**
 * V11a — verify OAuth-only role reads work WITHOUT a bot in the guild.
 *
 * ADR-0010 concluded that `guilds.members.read` does not require our
 * application to be present in the guild, reasoning from the fact that
 * `/users/@me/guilds/{id}/member` is a user-token endpoint with no stated
 * precondition — whereas `guilds.join`, which does require it, says so.
 *
 * That is inference from documentation structure, not an observed response,
 * and the entire auth model depends on it. This script observes it.
 *
 * RUN:
 *   node --env-file=.env.local scripts/verify-discord-oauth.mjs
 *
 * Needs AUTH_DISCORD_ID, AUTH_DISCORD_SECRET, DISCORD_GUILD_ID.
 *
 * ⚠️ Do NOT add the application to the guild before running. Adding it would
 * invalidate the test — a pass would no longer prove anything.
 */

import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';

const PORT = 53134;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const SCOPES = 'identify guilds guilds.members.read';
const API = 'https://discord.com/api/v10';

const CLIENT_ID = process.env.AUTH_DISCORD_ID;
const CLIENT_SECRET = process.env.AUTH_DISCORD_SECRET;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};
const log = (m = '') => console.log(m);
const ok = (m) => log(`${c.green}✓${c.reset} ${m}`);
const bad = (m) => log(`${c.red}✗${c.reset} ${m}`);
const warn = (m) => log(`${c.yellow}!${c.reset} ${m}`);

function requireEnv() {
  const missing = [
    ['AUTH_DISCORD_ID', CLIENT_ID],
    ['AUTH_DISCORD_SECRET', CLIENT_SECRET],
    ['DISCORD_GUILD_ID', GUILD_ID],
  ]
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length) {
    bad(`Missing environment variables: ${missing.join(', ')}`);
    log();
    log('Set them in .env.local, then run:');
    log(
      `  ${c.cyan}node --env-file=.env.local scripts/verify-discord-oauth.mjs${c.reset}`,
    );
    log();
    log(`${c.dim}Create a throwaway app at https://discord.com/developers/applications`);
    log(`Add this redirect URI:  ${REDIRECT_URI}${c.reset}`);
    process.exit(1);
  }
}

async function exchangeCode(code) {
  const res = await fetch(`${API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });

  if (!res.ok) {
    throw new Error(`Token exchange failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

async function callApi(path, token) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: res.status, ok: res.ok, body: await res.text() };
}

async function runChecks(accessToken) {
  let passed = true;

  // 1. identify
  const me = await callApi('/users/@me', accessToken);
  if (me.ok) {
    const u = JSON.parse(me.body);
    ok(`identify — signed in as ${c.bold}${u.username}${c.reset} (${u.id})`);
  } else {
    bad(`identify failed (${me.status})`);
    passed = false;
  }

  // 2. guilds — is the user actually in the clan guild?
  const guilds = await callApi('/users/@me/guilds', accessToken);
  if (guilds.ok) {
    const list = JSON.parse(guilds.body);
    const guild = list.find((g) => g.id === GUILD_ID);
    if (guild) {
      ok(`guilds — user is a member of ${c.bold}${guild.name}${c.reset}`);
    } else {
      bad(`guilds — user is NOT in guild ${GUILD_ID} (found ${list.length} others)`);
      warn(
        'Sign in with an account that IS in the clan server, or fix DISCORD_GUILD_ID.',
      );
      passed = false;
    }
  } else {
    bad(`guilds failed (${guilds.status})`);
    passed = false;
  }

  // 3. THE ACTUAL TEST — roles, with no bot in the guild
  log();
  log(`${c.bold}V11a — GET /users/@me/guilds/{id}/member${c.reset}`);
  const member = await callApi(`/users/@me/guilds/${GUILD_ID}/member`, accessToken);

  if (member.ok) {
    const m = JSON.parse(member.body);
    const roles = m.roles ?? [];
    ok(`${c.green}${c.bold}200 OK — returned ${roles.length} role ID(s)${c.reset}`);
    log();
    log(`  nick:   ${m.nick ?? '(none)'}`);
    log(`  joined: ${m.joined_at}`);
    log(
      `  roles:  ${roles.length ? roles.join('\n          ') : '(none — user has no roles)'}`,
    );
    log();

    if (roles.length === 0) {
      warn('No roles returned. The call SUCCEEDED, so V11a passes — but this');
      warn('account has no roles, so you cannot map role IDs from this run.');
      warn('Re-run with an account that holds Officer/Member to collect IDs.');
    } else {
      log(`${c.dim}Map these IDs to app tiers in the clan_config table.${c.reset}`);
    }
    return passed;
  }

  bad(`${c.bold}${member.status}${c.reset} — ${member.body.slice(0, 200)}`);
  log();
  if (member.status === 403) {
    bad('403 suggests the app may need to be IN the guild — ADR-0010 would be WRONG.');
  } else if (member.status === 401) {
    bad('401 — scope likely not granted. Confirm you consented to guilds.members.read.');
  }
  return false;
}

function verdict(passed) {
  log();
  log('─'.repeat(70));
  if (passed) {
    log(`${c.green}${c.bold}  V11a PASSED${c.reset}`);
    log();
    log('  OAuth-only role gating works with NO bot in the guild.');
    log('  ADR-0010 confirmed. P0 auth is unblocked.');
    log();
    log(`  ${c.dim}Update: ADR-0010 "Verification still required" -> confirmed,`);
    log(`  and remove V11a from CLAUDE.md open questions.${c.reset}`);
  } else {
    log(`${c.red}${c.bold}  V11a FAILED${c.reset}`);
    log();
    log('  Do NOT build auth against Discord roles yet.');
    log('  Reopen ADR-0010: with no bot allowed, roles must come from');
    log('  somewhere else — most likely admin-assigned tiers stored in our');
    log('  own database, decoupled from Discord roles entirely.');
  }
  log('─'.repeat(70));
  log();
}

function main() {
  requireEnv();

  const state = randomBytes(16).toString('hex');
  const authUrl = new URL('https://discord.com/oauth2/authorize');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('state', state);

  log();
  log(`${c.bold}V11a — Discord OAuth role read, without a bot${c.reset}`);
  log('─'.repeat(70));
  log(`Guild:  ${GUILD_ID}`);
  log(`Scopes: ${SCOPES}`);
  log();
  warn('The application must NOT be in the guild, or this proves nothing.');
  log();
  log(`${c.bold}Open this URL and approve:${c.reset}`);
  log();
  log(`${c.cyan}${authUrl.toString()}${c.reset}`);
  log();
  log(
    `${c.dim}Waiting for the callback on ${REDIRECT_URI} … (Ctrl+C to abort)${c.reset}`,
  );

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (url.pathname !== '/callback') {
      res.writeHead(404).end('Not found');
      return;
    }

    const respond = (msg) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!doctype html><meta charset="utf-8">
        <body style="font-family:system-ui;background:#0e1219;color:#eceef2;
                     display:grid;place-items:center;height:100vh;margin:0">
        <div style="text-align:center"><h1>${msg}</h1>
        <p style="color:#7d879a">Return to your terminal.</p></div>`);
    };

    const error = url.searchParams.get('error');
    if (error) {
      respond('Authorisation denied');
      log();
      bad(
        `Authorisation denied: ${error} — ${url.searchParams.get('error_description') ?? ''}`,
      );
      server.close();
      process.exit(1);
    }

    // CSRF check — the same protection the real app must implement (PRD §5.1).
    if (url.searchParams.get('state') !== state) {
      respond('State mismatch');
      log();
      bad('State parameter mismatch — possible CSRF. Aborting.');
      server.close();
      process.exit(1);
    }

    respond('Done — check your terminal');

    try {
      log();
      const tokens = await exchangeCode(url.searchParams.get('code'));
      ok('Token exchange succeeded');
      const granted = tokens.scope ?? '';
      if (!granted.includes('guilds.members.read')) {
        warn(`guilds.members.read NOT in granted scopes: "${granted}"`);
      }
      log();

      const passed = await runChecks(tokens.access_token);
      verdict(passed);
      server.close();
      process.exit(passed ? 0 : 1);
    } catch (err) {
      log();
      bad(err.message);
      verdict(false);
      server.close();
      process.exit(1);
    }
  });

  server.listen(PORT);
}

main();
