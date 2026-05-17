import { Counter, Histogram, Registry } from 'prom-client';

/**
 * Prometheus metrics for INSEE SIRENE integration (Story 1.3b validator
 * service + Story 1.3d AC4 observability). Mirrors the registry isolation
 * pattern of `keycloak.metrics.ts` so unit tests stay hermetic.
 *
 * Outcome labels:
 *   - success_active   — SIRET found and active in SIRENE
 *   - success_inactive — SIRET found but flagged inactive (422 to caller)
 *   - not_found        — SIRET not in the SIRENE register
 *   - rate_limited     — INSEE 429 (apiKey quota exceeded — 30 req/min/key)
 *   - unreachable      — Network error / 5xx after retries
 */

export const inseeMetricsRegistry = new Registry();

const INSEE_OUTCOMES = [
  'success_active',
  'success_inactive',
  'not_found',
  'rate_limited',
  'unreachable',
] as const;
export type InseeOutcome = (typeof INSEE_OUTCOMES)[number];

export const inseeCallsTotal = new Counter({
  name: 'tukio_insee_calls_total',
  help: 'Total INSEE SIRENE API calls by outcome.',
  labelNames: ['outcome'] as const,
  registers: [inseeMetricsRegistry],
});
INSEE_OUTCOMES.forEach((outcome) => inseeCallsTotal.inc({ outcome }, 0));

export const inseeDuration = new Histogram({
  name: 'tukio_insee_duration_seconds',
  help: 'Latency of a single INSEE SIRENE lookup (network + parse).',
  labelNames: ['outcome'] as const,
  // INSEE typical p95 < 800ms; widen buckets to catch the long tail on outages.
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [inseeMetricsRegistry],
});
