import { describe, it, expect, vi, beforeAll } from 'vitest';
import { Reflector } from '@nestjs/core';
import * as crypto from 'node:crypto';
import * as jwt from 'jsonwebtoken';
import nock from 'nock';
import { KeycloakJwtGuard } from './keycloak-jwt.guard.js';
import { JwksCacheService } from '../services/jwks-cache.service.js';
import { AuthNotAuthenticatedException } from '../exceptions/auth-not-authenticated.exception.js';
import type { TukioAuthConfig } from '../tukio-auth.module.js';

const CONFIG: TukioAuthConfig = {
  keycloakUrl: 'http://keycloak.test',
  realm: 'tukio',
  clientId: 'tukio-api',
};

let privateKey: string;
let publicKey: string;
const TEST_KID = 'test-kid-1';

beforeAll(() => {
  const pair = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  privateKey = pair.privateKey;
  publicKey = pair.publicKey;
});

function mockJwksEndpoint() {
  const keyObj = crypto.createPublicKey(publicKey);
  const jwk = { ...keyObj.export({ format: 'jwk' }), kid: TEST_KID, use: 'sig', alg: 'RS256' };
  nock('http://keycloak.test')
    .get('/realms/tukio/protocol/openid-connect/certs')
    .reply(200, { keys: [jwk] });
}

function signToken(payload: Record<string, unknown>) {
  return jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    keyid: TEST_KID,
    issuer: `${CONFIG.keycloakUrl}/realms/${CONFIG.realm}`,
    audience: CONFIG.clientId,
    expiresIn: 3600,
  });
}

function buildGuard() {
  const reflector = new Reflector();
  const jwksService = new JwksCacheService(CONFIG);
  vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
  jwksService.onModuleInit();
  return new KeycloakJwtGuard(reflector, jwksService, CONFIG);
}

function mockCtx(token: string | undefined, isPublic = false) {
  const reflector = new Reflector();
  vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(isPublic ? true : undefined);
  const request = {
    headers: { authorization: token ? `Bearer ${token}` : undefined },
    actor: undefined as unknown,
    jwt: undefined as unknown,
  };
  return {
    reflector,
    request,
    ctx: {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => function handler() {},
      getClass: () => class Ctrl {},
    } as unknown as Parameters<KeycloakJwtGuard['canActivate']>[0],
  };
}

describe('KeycloakJwtGuard', () => {
  it('allows @Public() routes without JWT', async () => {
    const reflector = new Reflector();
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const guard = new KeycloakJwtGuard(reflector, {} as unknown as JwksCacheService, CONFIG);
    const { ctx } = mockCtx(undefined, true);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('throws when Authorization header missing', async () => {
    mockJwksEndpoint();
    const guard = buildGuard();
    const { ctx } = mockCtx(undefined);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(AuthNotAuthenticatedException);
  });

  it('throws when JWT is malformed', async () => {
    mockJwksEndpoint();
    const guard = buildGuard();
    const { ctx } = mockCtx('not.a.valid.jwt');
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(AuthNotAuthenticatedException);
  });

  it('sets request.actor on valid JWT', async () => {
    mockJwksEndpoint();
    const token = signToken({
      sub: 'user-1',
      email: 'u@test.com',
      email_verified: true,
      realm_access: { roles: ['client'] },
    });
    const guard = buildGuard();
    const { ctx, request } = mockCtx(token);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect((request.actor as { userId: string }).userId).toBe('user-1');
  });
});
