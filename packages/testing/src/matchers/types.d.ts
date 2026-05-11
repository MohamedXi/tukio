// TypeScript declaration merging for custom matchers — gives apps using
// `@tukio/testing/matchers` autocomplete + type-safety on `expect(x).toBe…`.
import 'vitest';

declare module 'vitest' {
  interface Assertion<T = unknown> {
    toMatchSuccessEnvelope(expected?: { data?: unknown; code?: number }): T;
    toMatchErrorEnvelope(expected: { tukioCode: string; httpStatus?: number }): T;
    toBeUuid(): T;
    toBeIsoDate(): T;
  }
  interface AsymmetricMatchersContaining {
    toMatchSuccessEnvelope(expected?: { data?: unknown; code?: number }): unknown;
    toMatchErrorEnvelope(expected: { tukioCode: string; httpStatus?: number }): unknown;
    toBeUuid(): unknown;
    toBeIsoDate(): unknown;
  }
}

export {};
