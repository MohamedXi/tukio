import { Injectable, Inject, type OnModuleInit, type OnModuleDestroy } from '@nestjs/common';
import jwksRsa from 'jwks-rsa';
import { Counter, Registry } from 'prom-client';
import type { TukioAuthConfig } from '../tukio-auth.module.js';

export const JWKS_CACHE = Symbol('JWKS_CACHE');
export const authRegistry = new Registry();

const jwksRefreshFailures = new Counter({
  name: 'tukio_jwks_cache_refresh_failures_total',
  help: 'Total JWKS refresh failures',
  registers: [authRegistry],
});

// JwksCacheService wraps jwks-rsa (CJS-compatible) for RSA key fetching.
// Exposes getSigningKey() for guard usage + isHealthy() for /ready endpoint.
@Injectable()
export class JwksCacheService implements OnModuleInit, OnModuleDestroy {
  private client!: jwksRsa.JwksClient;
  private lastSuccessfulRefresh = 0;
  private refreshTimer?: ReturnType<typeof setInterval>;

  constructor(@Inject('TUKIO_AUTH_CONFIG') private readonly config: TukioAuthConfig) {}

  onModuleInit(): void {
    const jwksUri = `${this.config.keycloakUrl}/realms/${this.config.realm}/protocol/openid-connect/certs`;
    this.client = jwksRsa({
      jwksUri,
      cache: true,
      cacheMaxAge: this.config.jwksRefreshIntervalMs ?? 600_000,
      cacheMaxEntries: 10,
      rateLimit: true,
    });
    this.lastSuccessfulRefresh = Date.now();

    // Background probe to keep lastSuccessfulRefresh updated.
    this.refreshTimer = setInterval(async () => {
      try {
        await fetch(jwksUri);
        this.lastSuccessfulRefresh = Date.now();
      } catch {
        jwksRefreshFailures.inc();
      }
    }, this.config.jwksRefreshIntervalMs ?? 600_000);
  }

  onModuleDestroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  async getSigningKey(kid: string): Promise<string> {
    const key = await this.client.getSigningKey(kid);
    return key.getPublicKey();
  }

  isHealthy(): boolean {
    const thirtyMinMs = 30 * 60 * 1_000;
    return Date.now() - this.lastSuccessfulRefresh < thirtyMinMs;
  }
}
