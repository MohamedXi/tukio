import '@testing-library/jest-dom/vitest';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { toHaveNoViolations } from 'jest-axe';

// jest-axe exports { toHaveNoViolations: matcher } — spread directly
expect.extend(toHaveNoViolations);

// Explicit cleanup since globals: false disables auto-cleanup
afterEach(cleanup);
