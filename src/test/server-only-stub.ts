/**
 * Test stub for the `server-only` package.
 *
 * The real module throws when imported outside a React Server Component, which
 * is correct in the app and unhelpful in a unit test. Aliased in
 * vitest.config.ts so server-side modules can be imported directly.
 *
 * This does NOT weaken the guarantee: `server-only` still fails the build if a
 * client component imports one of these modules. It is only neutralised here.
 */
export {};
