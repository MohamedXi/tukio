import { CanActivate, ExecutionContext, Injectable, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import jwt from 'jsonwebtoken';
import type { JwksCacheService } from '../services/jwks-cache.service.js';
import { JWKS_CACHE } from '../services/jwks-cache.service.js';
import { ActorResolverService } from '../services/actor-resolver.service.js';
import { AuthNotAuthenticatedException } from '../exceptions/auth-not-authenticated.exception.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import type { TukioAuthConfig } from '../tukio-auth.module.js';
import type { KeycloakJwtPayload } from '../types/jwt-payload.js';

export const KEYCLOAK_JWT_GUARD = Symbol('KEYCLOAK_JWT_GUARD');

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

    try {
      // Decode header to get kid, then fetch the signing key from JWKS cache.
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || typeof decoded === 'string') {
        throw new Error('Malformed JWT');
      }
      const kid = decoded.header.kid as string | undefined;
      if (!kid) throw new Error('JWT missing kid header');

      const publicKey = await this.jwksCache.getSigningKey(kid);
      const issuer = this.config.issuer ?? `${this.config.keycloakUrl}/realms/${this.config.realm}`;
      const audience = this.config.audience ?? this.config.clientId;

      const audienceList = Array.isArray(audience) ? audience : [audience];
      const payload = jwt.verify(token, publicKey, {
        algorithms: ['RS256'],
        issuer,
        audience: audienceList[0],
      }) as KeycloakJwtPayload;

      request.actor = ActorResolverService.fromJwt(payload);
      request.jwt = payload;
      return true;
    } catch (e) {
      throw new AuthNotAuthenticatedException(
        `Invalid JWT: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}
