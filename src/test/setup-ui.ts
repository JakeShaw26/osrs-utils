import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library only auto-cleans when a global `afterEach` exists at import
// time, which depends on config ordering. Doing it explicitly means a component
// left mounted by one test can never leak into the next one's queries — that
// failure mode shows up as a test that passes alone and fails in the suite.
afterEach(cleanup);
