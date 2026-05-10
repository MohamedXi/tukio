import { describe, it, expect } from 'vitest';
import { correlationContext } from '../correlation-context.js';
import type { FastifyRequest } from '../correlation.middleware.js';

describe('correlationContext', () => {
  it('provides correlationId within a run context', async () => {
    await correlationContext.runWithContext('corr-abc', async () => {
      expect(correlationContext.getCorrelationId()).toBe('corr-abc');
    });
  });

  it('returns undefined outside a run context', () => {
    expect(correlationContext.getCorrelationId()).toBeUndefined();
  });

  it('propagates through nested async chains (Promise)', async () => {
    let captured: string | undefined;
    await correlationContext.runWithContext('corr-nested', async () => {
      await Promise.resolve().then(() => {
        captured = correlationContext.getCorrelationId();
      });
    });
    expect(captured).toBe('corr-nested');
  });

  it('propagates through setTimeout callbacks', async () => {
    let captured: string | undefined;
    await correlationContext.runWithContext(
      'corr-timer',
      () =>
        new Promise<void>((resolve) => {
          setTimeout(() => {
            captured = correlationContext.getCorrelationId();
            resolve();
          }, 0);
        }),
    );
    expect(captured).toBe('corr-timer');
  });

  it('does not leak correlationId between concurrent contexts', async () => {
    const results: string[] = [];
    await Promise.all([
      correlationContext.runWithContext('ctx-1', async () => {
        await new Promise((r) => setTimeout(r, 5));
        results.push(correlationContext.getCorrelationId() ?? 'none');
      }),
      correlationContext.runWithContext('ctx-2', async () => {
        await new Promise((r) => setTimeout(r, 1));
        results.push(correlationContext.getCorrelationId() ?? 'none');
      }),
    ]);
    expect(results).toContain('ctx-1');
    expect(results).toContain('ctx-2');
    expect(results).not.toContain('none');
  });
});

describe('correlationMiddleware', () => {
  it('extracts X-Tukio-Correlation-Id header', async () => {
    const { correlationMiddleware } = await import('../correlation.middleware.js');
    const req: FastifyRequest = { headers: { 'x-tukio-correlation-id': 'header-corr-id' } };
    let captured: string | undefined;
    await new Promise<void>((resolve) => {
      correlationMiddleware(req, null, () => {
        captured = req.correlationId;
        resolve();
      });
    });
    expect(captured).toBe('header-corr-id');
  });

  it('generates a UUID if no header present', async () => {
    const { correlationMiddleware } = await import('../correlation.middleware.js');
    const req: FastifyRequest = { headers: {} };
    await new Promise<void>((resolve) => {
      correlationMiddleware(req, null, () => resolve());
    });
    expect(req.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('uses first value when header is an array', async () => {
    const { correlationMiddleware } = await import('../correlation.middleware.js');
    const req: FastifyRequest = { headers: { 'x-tukio-correlation-id': ['arr-corr-id', 'other'] } };
    await new Promise<void>((resolve) => {
      correlationMiddleware(req, null, () => resolve());
    });
    expect(req.correlationId).toBe('arr-corr-id');
  });
});
