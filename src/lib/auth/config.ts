import 'server-only';
import NextAuth from 'next-auth';
import Discord from 'next-auth/providers/discord';
import { getEnv } from '@/lib/env';

/**
 * Auth.js (NextAuth v5) configuration.
 *
 * Discord is our identity provider and — pending V11a — our role source.
 * Note the split: identity is settled, role resolution is not, which is why
 * roles are resolved through `fetchClanRoleCheck` (swappable) rather than
 * being read inline here.
 *
 * ⚠️ TOKEN STORAGE — known deviation, must be closed before officer features.
 * PRD §5.2 requires the Discord access token be stored server-side and
 * encrypted at rest. Right now it lives in the Auth.js session JWT, which is a
 * JWE — encrypted with AUTH_SECRET, httpOnly, SameSite — so it is not readable
 * by JavaScript and not plaintext at rest. That is defensible but is NOT what
 * the PRD asks for. Moving tokens into the database (with refresh rotation) is
 * the next auth task. Flagged rather than quietly accepted.
 */

/**
 * Minimum scopes (docs/api-terms.md, Discord rule 1). Note `email` is
 * deliberately dropped from the provider default of "identify email" — we have
 * no use for it, and unused personal data is only a liability.
 */
export const OAUTH_SCOPES = 'identify guilds guilds.members.read';

/** PRD §5.2 — short sessions bound how long a stale role can persist. */
export const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;

export const { handlers, signIn, signOut, auth } = NextAuth(() => {
  const env = getEnv();

  return {
    providers: [
      Discord({
        clientId: env.AUTH_DISCORD_ID,
        clientSecret: env.AUTH_DISCORD_SECRET,
        authorization: { params: { scope: OAUTH_SCOPES } },
      }),
    ],

    session: { strategy: 'jwt', maxAge: SESSION_MAX_AGE_SECONDS },

    pages: { signIn: '/signin', error: '/signin' },

    callbacks: {
      /**
       * Gate 1 — guild membership, checked at sign-in.
       *
       * Returning false here stops a session ever being created for someone
       * outside the clan, so no downstream route has to defend against it.
       * Tier checks still happen per-request (§5.2); this is only the door.
       */
      async signIn({ account }) {
        if (account?.provider !== 'discord') return false;
        const accessToken = account.access_token;
        if (typeof accessToken !== 'string') return false;

        const { fetchClanRoleCheck } = await import('./discord');
        const { loadRoleMapping } = await import('./role-mapping');

        const check = await fetchClanRoleCheck({
          accessToken,
          guildId: getEnv().DISCORD_GUILD_ID,
          mapping: await loadRoleMapping(),
        });

        // Fail closed at the door too: only a definite "ok" lets someone in.
        // `unavailable` denies sign-in rather than admitting an unknown user —
        // an outage should stop new logins, never create unverified sessions.
        return check.status === 'ok';
      },

      async jwt({ token, account, profile }) {
        if (account && profile) {
          token.discordId = profile.id as string;
          token.accessToken = account.access_token;
          token.refreshToken = account.refresh_token;
          token.accessTokenExpiresAt = account.expires_at;
        }
        return token;
      },

      async session({ session, token }) {
        session.discordId = token.discordId as string | undefined;
        // The access token is intentionally NOT exposed to the client session.
        return session;
      },
    },
  };
});
