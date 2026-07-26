import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const alias = {
  '@': fileURLToPath(new URL('./src', import.meta.url)),
  // The real `server-only` throws outside a React Server Component, which
  // is correct in the app and unhelpful in a unit test. Stubbing it here
  // does not weaken the guarantee — it still fails the BUILD if a client
  // component imports a server module.
  'server-only': fileURLToPath(
    new URL('./src/test/server-only-stub.ts', import.meta.url),
  ),
};

/**
 * Two projects rather than one jsdom run for everything.
 *
 * jsdom costs roughly an order of magnitude more startup time per file than the
 * node environment, and the overwhelming majority of this repo's tests are pure
 * domain logic in lib/ with no DOM. Splitting on file extension keeps the fast
 * path fast: `.test.ts` is logic, `.test.tsx` renders components.
 */
export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'logic',
          environment: 'node',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: 'ui',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx'],
          setupFiles: ['./src/test/setup-ui.ts'],
          globals: true,
        },
      },
    ],
  },
});
