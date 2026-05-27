import { Counter, Histogram, Registry } from 'prom-client';

/**
 * Prometheus metrics for the auth login flow (Story 1.4d AC11).
 *
 * Registered on a dedicated registry (not the default global) so unit tests can
 * import without polluting the global prom-client registry across suites —
 * mirrors `registration.metrics.ts` (Story 1.2d) and `pro-registration.metrics.ts`.
 *
 * Note (amendment 2026-05-25): the Grafana dashboard JSON (AC11) is out of scope
 * — K8s/Grafana Cloud were dropped (ADR-015 MVP infra pivot to DO + docker
 * compose). These prom-client counters/histograms are retained and exposed for
 * whichever scrape mechanism the DO stack adopts.
 */

export const authMetricsRegistry = new Registry();

export const authLoginTotal = new Counter({
  name: 'tukio_auth_login_total',
  help: 'Auth login flow events by outcome (initiate / success / error).',
  labelNames: ['outcome'] as const,
  registers: [authMetricsRegistry],
});
(['initiate', 'success', 'error'] as const).forEach((outcome) =>
  authLoginTotal.inc({ outcome }, 0),
);

export const authCallbackDuration = new Histogram({
  name: 'tukio_auth_callback_duration_seconds',
  help: 'Latency of GET /v1/auth/callback (PKCE code→token exchange).',
  buckets: [0.05, 0.1, 0.5, 1, 3, 5, 10],
  registers: [authMetricsRegistry],
});

export const authRefreshTotal = new Counter({
  name: 'tukio_auth_refresh_total',
  help: 'Refresh-token rotation events by outcome (success / reused / expired / failed).',
  labelNames: ['outcome'] as const,
  registers: [authMetricsRegistry],
});
(['success', 'reused', 'expired', 'failed'] as const).forEach((outcome) =>
  authRefreshTotal.inc({ outcome }, 0),
);

export const authLogoutTotal = new Counter({
  name: 'tukio_auth_logout_total',
  help: 'Total logout (token revoke) calls.',
  registers: [authMetricsRegistry],
});

export const authWhoamiTotal = new Counter({
  name: 'tukio_auth_whoami_total',
  help: 'GET /v1/auth/whoami calls by outcome (success / error).',
  labelNames: ['outcome'] as const,
  registers: [authMetricsRegistry],
});
(['success', 'error'] as const).forEach((outcome) =>
  authWhoamiTotal.inc({ outcome }, 0),
);

export const authErrorsTotal = new Counter({
  name: 'tukio_auth_errors_total',
  help: 'Auth errors by tukioCode (AUTH-*).',
  labelNames: ['code'] as const,
  registers: [authMetricsRegistry],
});

/** Increment the AUTH-* error counter from a thrown error's tukioCode. */
export function recordAuthError(err: unknown): void {
  const code =
    typeof err === 'object' && err !== null && 'tukioCode' in err
      ? String(err.tukioCode)
      : 'AUTH-UNKNOWN-000';
  authErrorsTotal.inc({ code });
}
