import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { Reflector } from '@nestjs/core';
import { generateKeyPair, exportJWK, SignJWT, type KeyObject } from 'jose';
import nock from 'nock';
import { KeycloakJwtGuard } from './keycloak-jwt.guard.js';
import { JwksCacheService } from '../services/jwks-cache.service.js';
import { AuthNotAuthenticatedException } from '../exceptions/auth-not-authenticated.exception.js';
import type { TukioAuthConfig } from '../tukio-auth.module.js';
import { randomUUID } from 'node:crypto';

const CONFIG: TukioAuthConfig = {
  keycloakUrl: 'http://keycloak.test',
  realm: 'tukio',
  clientId: 'tukio-api',
};

const TEST_KID = 'test-kid-1';
let privateKey: KeyObject;
let publicJwk: Record<string, unknown>;

beforeAll(async () => {
  const pair = await generateKeyPair('RS256', { extractable: true });
  privateKey = pair.privateKey as KeyObject;
  const jwk = await exportJWK(pair.publicKey);
  publicJwk = { ...jwk, kid: TEST_KID, use: 'sig', alg: 'RS256' };
});

afterEach(() => {
  nock.cleanAll();
});

function mockJwksEndpoint(): void {
  nock('http://keycloak.test')
    .persist()
    .get('/realms/tukio/protocol/openid-connect/certs')
    .reply(200, { keys: [publicJwk] });
}

async function signToken(claims: Record<string, unknown>): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: TEST_KID })
    .setIssuer(`${CONFIG.keycloakUrl}/realms/${CONFIG.realm}`)
    .setAudience(CONFIG.clientId)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey);
}

async function buildGuard(): Promise<KeycloakJwtGuard> {
  const reflector = new Reflector();
  const jwksService = new JwksCacheService(CONFIG);
  vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
  await jwksService.onModuleInit();
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
    const guard = await buildGuard();
    const { ctx } = mockCtx(undefined);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(AuthNotAuthenticatedException);
  });

  it('throws when JWT is malformed', async () => {
    mockJwksEndpoint();
    const guard = await buildGuard();
    const { ctx } = mockCtx('not.a.valid.jwt');
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(AuthNotAuthenticatedException);
  });

  it('sets request.actor on valid JWT', async () => {
    mockJwksEndpoint();
    const userId = randomUUID();
    const token = await signToken({
      sub: userId,
      email: 'u@test.com',
      email_verified: true,
      realm_access: { roles: ['client'] },
    });
    const guard = await buildGuard();
    const { ctx, request } = mockCtx(token);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect((request.actor as { userId: string }).userId).toBe(userId);
  });

  it('rejects JWT with empty `sub`', async () => {
    mockJwksEndpoint();
    const token = await signToken({
      sub: '',
      realm_access: { roles: ['client'] },
    });
    const guard = await buildGuard();
    const { ctx } = mockCtx(token);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(AuthNotAuthenticatedException);
  });
});
