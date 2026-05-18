import type { ExecutionContext } from '@nestjs/common';
import { CsrfGuard } from './csrf.guard.js';
import { AuthCsrfMismatchException } from '../../../domain/exception/auth-csrf-mismatch.exception.js';

function fakeCtx(opts: {
  header?: string | string[];
  cookie?: string;
}): ExecutionContext {
  const req = {
    headers: { 'x-csrf-token': opts.header },
    cookies:
      opts.cookie === undefined ? {} : { 'tukio-csrf-token': opts.cookie },
  };
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as unknown as ExecutionContext;
}

describe('CsrfGuard (Story 1.4b AC7)', () => {
  const guard = new CsrfGuard();

  it('passes when header and cookie match', () => {
    const ctx = fakeCtx({ header: 'abc', cookie: 'abc' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws AuthCsrfMismatchException when header missing', () => {
    const ctx = fakeCtx({ header: undefined, cookie: 'abc' });
    expect(() => guard.canActivate(ctx)).toThrow(AuthCsrfMismatchException);
  });

  it('throws AuthCsrfMismatchException when cookie missing', () => {
    const ctx = fakeCtx({ header: 'abc', cookie: undefined });
    expect(() => guard.canActivate(ctx)).toThrow(AuthCsrfMismatchException);
  });

  it('throws AuthCsrfMismatchException when values differ', () => {
    const ctx = fakeCtx({ header: 'abc', cookie: 'def' });
    expect(() => guard.canActivate(ctx)).toThrow(AuthCsrfMismatchException);
  });

  it('rejects different lengths without leaking timing', () => {
    const ctx = fakeCtx({ header: 'abc', cookie: 'abcd' });
    expect(() => guard.canActivate(ctx)).toThrow(AuthCsrfMismatchException);
  });

  it('reads first value when header is an array', () => {
    const ctx = fakeCtx({ header: ['abc', 'def'], cookie: 'abc' });
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
