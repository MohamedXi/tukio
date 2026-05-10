import { describe, it, expect, vi } from 'vitest';
import { NextResponse } from 'next/server.js';
import { composeMiddlewares } from '../compose-middlewares.js';

describe('composeMiddlewares', () => {
  it('runs middlewares in order and returns NextResponse.next() when none redirect', async () => {
    const calls: string[] = [];
    const mw1 = vi.fn(async () => {
      calls.push('mw1');
      return undefined;
    });
    const mw2 = vi.fn(async () => {
      calls.push('mw2');
      return undefined;
    });

    const composed = composeMiddlewares(mw1 as never, mw2 as never);
    const result = await composed({} as never, {} as never);

    expect(calls).toEqual(['mw1', 'mw2']);
    expect(result).toBeInstanceOf(NextResponse);
  });

  it('short-circuits on a non-200 response (e.g. redirect)', async () => {
    const redirectResponse = NextResponse.redirect(new URL('https://auth.tukio.one'));
    const mw1 = vi.fn(async () => redirectResponse);
    const mw2 = vi.fn();

    const composed = composeMiddlewares(mw1 as never, mw2 as never);
    const result = await composed({} as never, {} as never);

    expect(result).toBe(redirectResponse);
    expect(mw2).not.toHaveBeenCalled();
  });

  it('continues past a middleware that returns a 200 NextResponse (pass-through)', async () => {
    const mw1 = vi.fn(async () => NextResponse.next());
    const mw2 = vi.fn(async () => undefined);

    const composed = composeMiddlewares(mw1 as never, mw2 as never);
    await composed({} as never, {} as never);

    expect(mw1).toHaveBeenCalled();
    expect(mw2).toHaveBeenCalled();
  });
});
