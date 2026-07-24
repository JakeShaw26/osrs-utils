import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // The real `server-only` throws outside a React Server Component, which
      // is correct in the app and unhelpful in a unit test. Stubbing it here
      // does not weaken the guarantee — it still fails the BUILD if a client
      // component imports a server module.
      'server-only': fileURLToPath(
        new URL('./src/test/server-only-stub.ts', import.meta.url),
      ),
    },
  },
  test: {
    // Node environment: everything tested here is pure domain logic in lib/.
    // Components are presentation over props (see components/README.md), so
    // there is nothing to render-test yet. Add jsdom when that changes.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
