// jsdom setup for @testing-library/react
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// With `globals: false` (vitest.config.ts), Testing Library's automatic
// afterEach cleanup is NOT auto-registered (it only hooks in when a global
// afterEach exists). Register it explicitly so rendered trees are unmounted
// between tests — otherwise repeated `data-testid` queries match stale nodes.
afterEach(() => {
  cleanup();
});
