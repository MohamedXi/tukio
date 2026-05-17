import { Counter, Histogram, Registry } from 'prom-client';

/**
 * Prometheus metrics for the Pro registration endpoint (Story 1.3d AC4 /
 * Story 1.3 Task 10). Mirrors the `customer` registry from Story 1.2d so
 * dashboards stay consistent across both flows.
 *
 * Registered on a dedicated registry (not the default global) so unit tests
 * can import without polluting the global prom-client registry across suites.
 *
 * Usage in `RegisterProForwarder` or a NestJS interceptor on the controller:
 *   import {
 *     proRegistrationAttempts,
 *     proRegistrationDuration,
 *   } from './pro-registration.metrics';
 *
 *   const end = proRegistrationDuration.startTimer({ outcome: 'success' });
 *   // ... forward ...
 *   end();
 *   proRegistrationAttempts.inc({ outcome });
 */

export const proRegistrationMetricsRegistry = new Registry();

const PRO_REGISTRATION_OUTCOMES = [
  'success',
  'conflict', // IDENTITY-CONFLICT-001/002 (email or SIRET)
  'validation_failed', // VALIDATION-FAILED-001 / IDENTITY-VALIDATION-003 (INSEE inactive)
  'external_unreachable', // EXTERNAL-002/003 / IDENTITY-EXTERNAL-001
  'throttled', // RATE-LIMIT-EXCEEDED-001
] as const;
export type ProRegistrationOutcome = (typeof PRO_REGISTRATION_OUTCOMES)[number];

export const proRegistrationAttempts = new Counter({
  name: 'tukio_register_pro_total',
  help: 'Total Pro registration attempts by outcome.',
  labelNames: ['outcome'] as const,
  registers: [proRegistrationMetricsRegistry],
});
// Warm-up labels so Grafana sees series at boot before traffic arrives.
PRO_REGISTRATION_OUTCOMES.forEach((outcome) =>
  proRegistrationAttempts.inc({ outcome }, 0),
);

const PRO_REGISTRATION_STEPS = [
  'identity',
  'activity',
  'documents',
  'review',
] as const;

export const proRegistrationStepCompleted = new Counter({
  name: 'tukio_register_pro_step_completed_total',
  help: 'Number of times each wizard step was completed (Story 1.3d v2 AC10).',
  labelNames: ['step'] as const,
  registers: [proRegistrationMetricsRegistry],
});
PRO_REGISTRATION_STEPS.forEach((step) =>
  proRegistrationStepCompleted.inc({ step }, 0),
);

export const proRegistrationDuration = new Histogram({
  name: 'tukio_register_pro_duration_seconds',
  help: 'End-to-end latency of POST /v1/auth/pro/register (multipart parse + identity-svc forward).',
  labelNames: ['outcome'] as const,
  // Pro registration is heavier than customer because identity-svc fans out to
  // INSEE SIRENE + Keycloak + R2 + DB. Buckets reflect that p95 budget.
  buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 15, 30],
  registers: [proRegistrationMetricsRegistry],
});
