import { AsyncLocalStorage } from 'node:async_hooks';

export const CORRELATION_CONTEXT = Symbol('CORRELATION_CONTEXT');

interface CorrelationStore {
  correlationId: string;
}

const als = new AsyncLocalStorage<CorrelationStore>();

// AsyncLocalStorage-based correlation ID propagation.
// Wraps entire async execution trees (HTTP requests, NATS consumers)
// so correlationId flows through without explicit parameter passing.
export const correlationContext = {
  runWithContext: <T>(correlationId: string, callback: () => Promise<T>): Promise<T> =>
    als.run({ correlationId }, callback),

  getCorrelationId: (): string | undefined => als.getStore()?.correlationId,
};
