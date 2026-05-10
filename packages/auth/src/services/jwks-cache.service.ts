import { Injectable, Inject, type OnModuleInit, type OnModuleDestroy } from '@nestjs/common';
import { createRemoteJWKSet, type JWTVerifyGetKey } from 'jose';
import { Counter, Registry } from 'prom-client';
import type { TukioAuthConfig } from '../tukio-auth.module.js';

export const JWKS_CACHE = Symbol('JWKS_CACHE');
export const authRegistry = new Registry();

const JWKS_REFRESH_FAILURES = 'tukio_jwks_cache_refresh_failures_total';
const jwksRefreshFailures =
  (authRegistry.getSingleMetric(JWKS_REFRESH_FAILURES) as Counter | undefined) ??
  new Counter({
    name: JWKS_REFRESH_FAILURES,
    help: 'Total JWKS refresh failures (network/HTTP).',
    registers: [authRegistry],
  });

const HEALTH_WINDOW_MS = 30 * 60 * 1_000;
const FETCH_TIMEOUT_MS = 5_000;

// JwksCacheService wraps `jose.createRemoteJWKSet` for RS256 key resolution.
// jose itself handles in-memory caching + refetch on unknown kid; this service
// adds a healthcheck (lastSuccessfulRefresh) and a Prometheus failure counter.
@Injectable()
export class JwksCacheService implements OnModuleInit, OnModuleDestroy {
  private jwksUri = '';
  private getKey!: JWTVerifyGetKey;
  private lastSuccessfulRefresh = 0;
  private refreshTimer?: ReturnType<typeof setInterval>;
  private refreshAbort?: AbortController;

  constructor(@Inject('TUKIO_AUTH_CONFIG') private readonly config: TukioAuthConfig) {}

  async onModuleInit(): Promise<void> {
    this.jwksUri = `${this.config.keycloakUrl}/realms/${this.config.realm}/protocol/openid-connect/certs`;
    const cooldownMs = this.config.jwksRefreshIntervalMs ?? 600_000;
    this.getKey = createRemoteJWKSet(new URL(this.jwksUri), {
      cooldownDuration: cooldownMs,
    });

    // Verify Keycloak reachability at boot — only mark healthy on real success.
    try {
      await this.probeJwks();
      this.lastSuccessfulRefresh = Date.now();
    } catch {
      jwksRefreshFailures.inc();
      // leave lastSuccessfulRefresh = 0 → /ready reports unhealthy
    }

    this.refreshTimer = setInterval(() => void this.backgroundProbe(), cooldownMs);
  }

  onModuleDestroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.refreshAbort?.abort();
  }

  // Returns the jose JWTVerifyGetKey resolver — used by KeycloakJwtGuard.
  getKeyResolver(): JWTVerifyGetKey {
    return this.getKey;
  }

  isHealthy(): boolean {
    return (
      this.lastSuccessfulRefresh > 0 && Date.now() - this.lastSuccessfulRefresh < HEALTH_WINDOW_MS
    );
  }

  private async backgroundProbe(): Promise<void> {
    try {
      await this.probeJwks();
      this.lastSuccessfulRefresh = Date.now();
    } catch {
      jwksRefreshFailures.inc();
      // Stale cache stays usable; isHealthy() falls below threshold after 30 min.
    }
  }

  private async probeJwks(): Promise<void> {
    this.refreshAbort?.abort();
    this.refreshAbort = new AbortController();
    const timeoutId = setTimeout(() => this.refreshAbort?.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(this.jwksUri, { signal: this.refreshAbort.signal });
      if (!res.ok) {
        throw new Error(`JWKS endpoint returned ${res.status}`);
      }
      const body = (await res.json()) as { keys?: unknown[] };
      if (!Array.isArray(body.keys) || body.keys.length === 0) {
        throw new Error('JWKS response has empty/missing keys array');
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
