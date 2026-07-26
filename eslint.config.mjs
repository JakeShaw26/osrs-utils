import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

/**
 * Conventions that are only written down get violated. These rules make the
 * atomic-design hierarchy and the data-source rules enforceable at lint time.
 *
 * eslint-config-next v16 ships native flat configs, so they are imported
 * directly — no FlatCompat shim.
 */
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypeScript,

  {
    // `.claude/worktrees` holds full checkouts, each with its own node_modules.
    // The `node_modules/**` pattern above is cwd-relative and does not match a
    // nested copy, so without this line lint walks every dependency in every
    // agent worktree — tens of thousands of problems from code we do not own.
    ignores: ['.next/**', 'node_modules/**', 'drizzle/**', '.claude/worktrees/**'],
  },

  /* --- Atomic design: a layer may only import from layers below it --------- */
  {
    files: ['src/components/atoms/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/components/molecules/*',
                '@/components/organisms/*',
                '@/components/templates/*',
              ],
              message:
                'Atoms may not import higher layers. If it needs another component, it is a molecule.',
            },
            {
              group: ['@/lib/db*', '@/lib/api*', '@/lib/env*'],
              message:
                'Atoms must not fetch, touch the database, or read env. Pass data in as props. (PRD §6.2)',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/components/molecules/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/components/organisms/*', '@/components/templates/*'],
              message: 'Molecules may only compose atoms.',
            },
            {
              group: ['@/lib/db*', '@/lib/api*'],
              message:
                'Molecules must not fetch or touch the database. Pass data in as props. (PRD §6.2)',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/components/templates/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/lib/db*', '@/lib/api*'],
              message:
                'Templates define layout only. Fetch in app/ and pass down. (PRD §6.2)',
            },
          ],
        },
      ],
    },
  },

  /* --- Data source guardrails --------------------------------------------- */
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/lib/api/osrs-fetch.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.name='fetch'] > Literal[value=/runescape|wiseoldman|templeosrs/i]",
          message:
            'Call OSRS APIs through osrsFetch() — it sets the mandatory User-Agent and the cache TTL. (PRD §2.1)',
        },
      ],
    },
  },
];

export default eslintConfig;
