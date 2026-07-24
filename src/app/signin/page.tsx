import type { Metadata } from 'next';
import { signIn } from '@/lib/auth/config';
import { Button } from '@/components/atoms/Button';

export const metadata: Metadata = { title: 'Sign in' };

/**
 * Sign-in page.
 *
 * A server component with a server action — no client JavaScript is needed to
 * start an OAuth flow, so none is shipped.
 *
 * Errors arrive as a query param from Auth.js. `AccessDenied` is the case that
 * matters here: it means the guild-membership gate in config.ts rejected them
 * (PRD §5.1), so the copy explains that rather than showing a generic failure.
 */

const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied:
    "You're not a member of the clan Discord server, so there's nothing here for you yet. If you've just joined, try again in a moment.",
  Configuration:
    'The sign-in service is misconfigured. This is our problem, not yours — please report it.',
  Verification: 'That sign-in link has expired. Please try again.',
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error
    ? (ERROR_MESSAGES[error] ?? 'Something went wrong signing you in. Please try again.')
    : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-12">
      <div className="rounded-card border border-border bg-surface-raised p-6 shadow-card">
        <h1 className="text-xl font-bold tracking-tight text-content">
          Sign in to OSRS Clan Toolkit
        </h1>
        <p className="mt-2 text-sm text-content-muted">
          Sign in with the Discord account you use in the clan server. Your rank there
          decides what you can see here.
        </p>

        {message ? (
          <p
            role="alert"
            className="mt-4 rounded-control border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
          >
            {message}
          </p>
        ) : null}

        <form
          className="mt-6"
          action={async () => {
            'use server';
            await signIn('discord', { redirectTo: '/' });
          }}
        >
          <Button type="submit" className="w-full">
            Continue with Discord
          </Button>
        </form>

        <p className="mt-4 text-2xs text-content-subtle">
          We read your Discord username, avatar, and your roles in the clan server.
          Nothing else, and nothing is posted on your behalf.
        </p>
      </div>
    </main>
  );
}
