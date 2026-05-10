import { describe, it, expect, vi, afterEach } from 'vitest';
import nock from 'nock';
import * as crypto from 'node:crypto';
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

function buildJwks() {
  const { publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const keyObj = crypto.createPublicKey(publicKey);
  return {
    keys: [{ ...keyObj.export({ format: 'jwk' }), kid: 'test-kid', use: 'sig', alg: 'RS256' }],
  };
}

describe('JwksCacheService', () => {
  it('initialises and exposes getSigningKey()', async () => {
    const jwks = buildJwks();
    nock('http://keycloak.test')
      .get('/realms/tukio/protocol/openid-connect/certs')
      .reply(200, jwks);

    const svc = new JwksCacheService(CONFIG);
    svc.onModuleInit();
    const key = await svc.getSigningKey('test-kid');
    expect(typeof key).toBe('string');
    expect(key).toContain('-----BEGIN PUBLIC KEY-----');
  });

  it('isHealthy() returns true right after init', () => {
    const svc = new JwksCacheService(CONFIG);
    svc.onModuleInit();
    expect(svc.isHealthy()).toBe(true);
  });

  it('isHealthy() returns false if last refresh is stale', () => {
    const svc = new JwksCacheService(CONFIG);
    (svc as unknown as { lastSuccessfulRefresh: number }).lastSuccessfulRefresh = 0;
    expect(svc.isHealthy()).toBe(false);
  });

  it('onModuleDestroy clears the interval', () => {
    const svc = new JwksCacheService(CONFIG);
    svc.onModuleInit();
    expect(() => svc.onModuleDestroy()).not.toThrow();
  });
});
