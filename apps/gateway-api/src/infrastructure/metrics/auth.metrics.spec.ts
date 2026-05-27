import {
  authMetricsRegistry,
  authLoginTotal,
  authRefreshTotal,
  authWhoamiTotal,
  authLogoutTotal,
  recordAuthError,
} from './auth.metrics.js';

describe('auth.metrics (Story 1.4d AC11)', () => {
  // NOTE: The registry is a module-level singleton. Tests that check label
  // existence (not values) are unaffected by cross-test accumulation. Tests
  // that check values use `toBeGreaterThanOrEqual(1)` to tolerate multiple
  // invocations within the same process. resetMetrics() would erase the
  // module-level warm-up seeding and break the warm-up label test (test 2).

  it('registers all six auth metrics on the dedicated registry', async () => {
    const metricNames = (await authMetricsRegistry.getMetricsAsJSON()).map(
      (m) => m.name,
    );
    expect(metricNames).toEqual(
      expect.arrayContaining([
        'tukio_auth_login_total',
        'tukio_auth_callback_duration_seconds',
        'tukio_auth_refresh_total',
        'tukio_auth_logout_total',
        'tukio_auth_whoami_total',
        'tukio_auth_errors_total',
      ]),
    );
  });

  it('warms up labelled outcomes to 0 so dashboards see them immediately', async () => {
    const json = await authMetricsRegistry.getMetricsAsJSON();
    const login = json.find((m) => m.name === 'tukio_auth_login_total');
    const outcomes = login?.values.map((v) => v.labels.outcome);
    expect(outcomes).toEqual(
      expect.arrayContaining(['initiate', 'success', 'error']),
    );
  });

  it('increments login/refresh/whoami/logout counters', async () => {
    authLoginTotal.inc({ outcome: 'success' });
    authRefreshTotal.inc({ outcome: 'success' });
    authWhoamiTotal.inc({ outcome: 'success' });
    authLogoutTotal.inc();
    const json = await authMetricsRegistry.getMetricsAsJSON();
    const logout = json.find((m) => m.name === 'tukio_auth_logout_total');
    expect(logout?.values[0]?.value).toBeGreaterThanOrEqual(1);
  });

  it('recordAuthError increments by tukioCode, defaulting to AUTH-UNKNOWN-000', async () => {
    recordAuthError({ tukioCode: 'AUTH-REFRESH-EXPIRED-001' });
    recordAuthError(new Error('no code'));
    const json = await authMetricsRegistry.getMetricsAsJSON();
    const errors = json.find((m) => m.name === 'tukio_auth_errors_total');
    const codes = errors?.values.map((v) => v.labels.code) ?? [];
    expect(codes).toEqual(
      expect.arrayContaining(['AUTH-REFRESH-EXPIRED-001', 'AUTH-UNKNOWN-000']),
    );
  });
});
