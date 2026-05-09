/**
 * Compile-time type narrowing tests for token types.
 * If types drift, the `AssertEqual<...> = true` lines fail to compile.
 */
import { describe, it, expect } from 'vitest';
import type { BrandShade } from '../tokens/colors.js';

type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

type AssertEqual<A, B> = Equals<A, B> extends true ? true : never;

describe('Token type narrowing', () => {
  it('BrandShade narrows to "50" | "100" | ... | "900"', () => {
    // colors.brand uses numeric keys → BrandShade is a union of number literals
    type ExpectedShades = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
    const _check: AssertEqual<BrandShade, ExpectedShades> = true;
    expect(_check).toBe(true);
  });
});
