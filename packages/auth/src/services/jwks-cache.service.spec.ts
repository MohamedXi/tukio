import { describe, it, expect, vi, afterEach } from 'vitest';
import nock from 'nock';
import { exportJWK, generateKeyPair } from 'jose';
import { JwksCacheService } from './jwks-cache.service.js';
import type { TukioAuthConfig } from '../tukio-auth.module.js';

const CONFIG: TukioAuthConfig = {
  keycloakUrl: 'http://keycloak.test',
  realm: 'tukio',
  clientId: 'tukio-api',
  jwksRefreshIntervalMs: 3_000_000,
};

afterEach(() => {
  nock.cleanAll();
  vi.restoreAllMocks();
});

async function buildJwks(): Promise<{ keys: Record<string, unknown>[] }> {
  const pair = await generateKeyPair('RS256', { extractable: true });
  const jwk = await exportJWK(pair.publicKey);
  return { keys: [{ ...jwk, kid: 'test-kid', use: 'sig', alg: 'RS256' }] };
}

describe('JwksCacheService', () => {
  it('initialises and reports healthy after a successful Keycloak probe', async () => {
    const jwks = await buildJwks();
    nock('http://keycloak.test')
      .get('/realms/tukio/protocol/openid-connect/certs')
      .reply(200, jwks);

    const svc = new JwksCacheService(CONFIG);
    await svc.onModuleInit();
    expect(svc.isHealthy()).toBe(true);
    expect(typeof svc.getKeyResolver()).toBe('function');
    svc.onModuleDestroy();
  });

  it('isHealthy() returns false when init probe fails', async () => {
    nock('http://keycloak.test')
      .get('/realms/tukio/protocol/openid-connect/certs')
      .reply(503, 'Service unavailable');

    const svc = new JwksCacheService(CONFIG);
    await svc.onModuleInit();
    expect(svc.isHealthy()).toBe(false);
    svc.onModuleDestroy();
  });

  it('isHealthy() returns false when JWKS body is empty', async () => {
    nock('http://keycloak.test')
      .get('/realms/tukio/protocol/openid-connect/certs')
      .reply(200, { keys: [] });

    const svc = new JwksCacheService(CONFIG);
    await svc.onModuleInit();
    expect(svc.isHealthy()).toBe(false);
    svc.onModuleDestroy();
  });

  it('isHealthy() returns false if last refresh is stale (> 30 min)', async () => {
    const jwks = await buildJwks();
    nock('http://keycloak.test')
      .get('/realms/tukio/protocol/openid-connect/certs')
      .reply(200, jwks);

    const svc = new JwksCacheService(CONFIG);
    await svc.onModuleInit();
    (svc as unknown as { lastSuccessfulRefresh: number }).lastSuccessfulRefresh =
      Date.now() - 31 * 60 * 1_000;
    expect(svc.isHealthy()).toBe(false);
    svc.onModuleDestroy();
  });

  it('onModuleDestroy aborts in-flight probe and clears the interval', async () => {
    const jwks = await buildJwks();
    nock('http://keycloak.test')
      .get('/realms/tukio/protocol/openid-connect/certs')
      .reply(200, jwks);

    const svc = new JwksCacheService(CONFIG);
    await svc.onModuleInit();
    expect(() => svc.onModuleDestroy()).not.toThrow();
  });
});
