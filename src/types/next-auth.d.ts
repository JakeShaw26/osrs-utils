import 'next-auth';
import 'next-auth/jwt';

/**
 * Module augmentation for the fields we add in the Auth.js callbacks.
 * Without this, `session.discordId` and the token fields are `any`, which
 * defeats strict mode exactly where correctness matters most.
 */

declare module 'next-auth' {
  interface Session {
    /** Discord snowflake. Safe to expose — it is a public identifier. */
    discordId?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    discordId?: string;
    /** Never forwarded to the client session. See lib/auth/config.ts. */
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpiresAt?: number;
  }
}
