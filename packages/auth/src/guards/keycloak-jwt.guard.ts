import { CanActivate, ExecutionContext, Injectable, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { jwtVerify, errors as joseErrors } from 'jose';
import { z } from 'zod';
import type { JwksCacheService } from '../services/jwks-cache.service.js';
import { JWKS_CACHE } from '../services/jwks-cache.service.js';
import { ActorResolverService } from '../services/actor-resolver.service.js';
import { AuthNotAuthenticatedException } from '../exceptions/auth-not-authenticated.exception.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import type { TukioAuthConfig } from '../tukio-auth.module.js';
import type { KeycloakJwtPayload } from '../types/jwt-payload.js';

export const KEYCLOAK_JWT_GUARD = Symbol('KEYCLOAK_JWT_GUARD');

// 5 seconds tolerance — Kubernetes / cloud NTP drift is usually < 2s, but we
// give a safety margin to avoid spurious 401s on the boundary.
const CLOCK_TOLERANCE_S = 5;

// Runtime validation of the JWT payload. Keycloak should always emit these,
// but we never trust the wire format — empty/null `sub` is a security incident.
const KeycloakJwtPayloadSchema = z.object({
  sub: z.string().min(1),
  iss: z.string().min(1),
  aud: z.union([z.string(), z.array(z.string())]),
  exp: z.number().int().positive(),
  iat: z.number().int().positive(),
  realm_access: z.object({ roles: z.array(z.string()) }).optional(),
  resource_access: z.record(z.string(), z.object({ roles: z.array(z.string()) })).optional(),
  email: z.string().optional(),
  email_verified: z.boolean().optional(),
  given_name: z.string().optional(),
  family_name: z.string().optional(),
  preferred_username: z.string().optional(),
  locale: z.string().optional(),
  amr: z.array(z.string()).optional(),
  acr: z.string().optional(),
  jti: z.string().optional(),
});

@Injectable()
export class KeycloakJwtGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(JWKS_CACHE) private readonly jwksCache: JwksCacheService,
    @Inject('TUKIO_AUTH_CONFIG') private readonly config: TukioAuthConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context
      .switchToHttp()
      .getRequest<{ headers: { authorization?: string }; actor: unknown; jwt: unknown }>();

    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AuthNotAuthenticatedException('Missing Authorization header');
    }
    const token = authHeader.slice(7);

    const issuer = this.config.issuer ?? `${this.config.keycloakUrl}/realms/${this.config.realm}`;
    const audience = this.config.audience ?? this.config.clientId;

    try {
      const { payload } = await jwtVerify(token, this.jwksCache.getKeyResolver(), {
        algorithms: ['RS256'],
        issuer,
        audience,
        clockTolerance: CLOCK_TOLERANCE_S,
      });

      // Runtime-validate the payload shape. Cast → throw on schema violation.
      const validated = KeycloakJwtPayloadSchema.parse(payload) as KeycloakJwtPayload;

      request.actor = ActorResolverService.fromJwt(validated);
      request.jwt = validated;
      return true;
    } catch (e) {
      if (e instanceof joseErrors.JWTExpired) {
        throw new AuthNotAuthenticatedException('JWT expired');
      }
      if (e instanceof joseErrors.JWTClaimValidationFailed) {
        throw new AuthNotAuthenticatedException(`JWT claim validation failed: ${e.claim}`);
      }
      throw new AuthNotAuthenticatedException(
        `Invalid JWT: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}
