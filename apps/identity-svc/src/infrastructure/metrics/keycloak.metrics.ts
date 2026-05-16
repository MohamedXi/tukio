import { Counter, Registry } from 'prom-client';

/**
 * Prometheus metrics for Keycloak admin calls and registration failures
 * in identity-svc (Story 1.2d Task 7.2).
 */

export const keycloakMetricsRegistry = new Registry();

export const keycloakAdminCalls = new Counter({
  name: 'tukio_keycloak_admin_calls_total',
  help: 'Total Keycloak Admin API calls from identity-svc.',
  labelNames: ['operation', 'status'] as const,
  registers: [keycloakMetricsRegistry],
});

export const registerExternalFailures = new Counter({
  name: 'tukio_register_customer_external_failures_total',
  help: 'Total registration failures due to Keycloak Admin API or other external services.',
  registers: [keycloakMetricsRegistry],
});
