import { handlers } from '@/lib/auth/config';

/**
 * Auth.js route handler — sign-in, callback, sign-out.
 * Discord's redirect URI must point at /api/auth/callback/discord.
 */
export const { GET, POST } = handlers;
