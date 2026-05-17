import {
  InseeSiretNotFoundError,
  InseeRateLimitError,
  InseeUnreachableError,
  InseeAuthFailedError,
} from './insee-siret-validator.port.js';

describe('InseeSiretNotFoundError', () => {
  it('includes the SIRET in the message', () => {
    const err = new InseeSiretNotFoundError('35600000000048');
    expect(err.message).toContain('35600000000048');
    expect(err.name).toBe('InseeSiretNotFoundError');
    expect(err).toBeInstanceOf(InseeSiretNotFoundError);
    expect(err).toBeInstanceOf(Error);
  });
});

describe('InseeRateLimitError', () => {
  it('exposes the retryAfterMs delay', () => {
    const err = new InseeRateLimitError(30_000);
    expect(err.retryAfterMs).toBe(30_000);
    expect(err.message).toContain('30000');
    expect(err.name).toBe('InseeRateLimitError');
    expect(err).toBeInstanceOf(InseeRateLimitError);
  });

  it('accepts a 0 retry delay (rate-limit window already elapsed)', () => {
    const err = new InseeRateLimitError(0);
    expect(err.retryAfterMs).toBe(0);
  });
});

describe('InseeUnreachableError', () => {
  it('stores the message and optional underlying error', () => {
    const underlying = new Error('fetch timed out');
    const err = new InseeUnreachableError('INSEE network error', underlying);
    expect(err.message).toBe('INSEE network error');
    expect(err.underlyingError).toBe(underlying);
    expect(err.name).toBe('InseeUnreachableError');
    expect(err).toBeInstanceOf(InseeUnreachableError);
  });

  it('accepts no underlying error', () => {
    const err = new InseeUnreachableError('INSEE 503');
    expect(err.underlyingError).toBeUndefined();
  });
});

describe('InseeAuthFailedError', () => {
  it('exposes the upstream HTTP status (Story 1.3b review P5)', () => {
    const err = new InseeAuthFailedError(401);
    expect(err.status).toBe(401);
    expect(err.message).toContain('401');
    expect(err.name).toBe('InseeAuthFailedError');
    expect(err).toBeInstanceOf(InseeAuthFailedError);
    expect(err).toBeInstanceOf(Error);
  });

  it('handles a 403 forbidden status', () => {
    const err = new InseeAuthFailedError(403);
    expect(err.status).toBe(403);
    expect(err.message).toContain('403');
  });
});
