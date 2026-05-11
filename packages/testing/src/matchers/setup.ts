import { expect } from 'vitest';
import { toMatchSuccessEnvelope, toMatchErrorEnvelope } from './to-match-envelope.matcher.js';
import { toBeUuid } from './to-be-uuid.matcher.js';
import { toBeIsoDate } from './to-be-iso-date.matcher.js';

// Apps add this file to vitest.config.ts `setupFiles` to register the
// matchers globally:
//
//   import { defineConfig } from 'vitest/config';
//   export default defineConfig({
//     test: { setupFiles: ['@tukio/testing/matchers'] },
//   });
expect.extend({ toMatchSuccessEnvelope, toMatchErrorEnvelope, toBeUuid, toBeIsoDate });
