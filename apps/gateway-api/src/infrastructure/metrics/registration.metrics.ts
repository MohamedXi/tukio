import { Counter, Histogram, Registry } from 'prom-client';

/**
 * Prometheus metrics for the customer registration endpoint (Story 1.2d Task 7.1).
 *
 * Registered on a dedicated registry (not the default global) so unit tests can
 * import without polluting the global prom-client registry across suites.
 *
 * Usage in `RegisterCustomerForwarder` or a NestJS interceptor:
 *   import { registrationAttempts, registrationDuration } from './registration.metrics';
 *   registrationAttempts.inc({ result: 'success' });
 *   const end = registrationDuration.startTimer();
 *   // ... forward ...
 *   end(); // records duration
 */

export const registrationMetricsRegistry = new Registry();

export const registrationAttempts = new Counter({
  name: 'tukio_register_customer_attempts_total',
  help: 'Total customer registration attempts by outcome.',
  labelNames: ['result'] as const,
  registers: [registrationMetricsRegistry],
});
// Warm-up label values so Grafana dashboards see them immediately on start.
(
  [
    'success',
    'conflict',
    'validation_error',
    'rate_limit',
    'external_error',
  ] as const
).forEach((result) => registrationAttempts.inc({ result }, 0));

export const registrationDuration = new Histogram({
  name: 'tukio_register_customer_duration_seconds',
  help: 'Latency of POST /v1/auth/customer/register including downstream identity-svc call.',
  labelNames: ['result'] as const,
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [registrationMetricsRegistry],
});
