import Keycloak from 'keycloak-js';
import type { KeycloakConfig } from './types.js';
import { KeycloakInitError } from './types.js';
import type { Role } from '../types/actor.js';

export const ROLE_PRECEDENCE: Role[] = [
  'admin-super',
  'admin-modo',
  'admin-support',
  'pro',
  'client',
];

export function extractRole(roles: string[]): Role {
  for (const r of ROLE_PRECEDENCE) {
    if (roles.includes(r)) return r;
  }
  return 'client';
}

// Thin wrapper around keycloak-js with Tukio defaults.
export class KeycloakClient {
  private readonly kc: Keycloak;

  constructor(config: KeycloakConfig) {
    this.kc = new Keycloak({
      url: config.url,
      realm: config.realm,
      clientId: config.clientId,
    });
  }

  async init(): Promise<boolean> {
    try {
      return await this.kc.init({
        onLoad: 'check-sso',
        silentCheckSsoRedirectUri:
          typeof window !== 'undefined'
            ? `${window.location.origin}/silent-check-sso.html`
            : undefined,
        checkLoginIframe: false,
        pkceMethod: 'S256',
      });
    } catch (e) {
      throw new KeycloakInitError(
        `Keycloak init failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  login(redirectUri?: string): Promise<void> {
    return this.kc.login({ redirectUri });
  }

  logout(redirectUri?: string): Promise<void> {
    return this.kc.logout({ redirectUri });
  }

  register(): Promise<void> {
    return this.kc.register();
  }

  async updateToken(minValidity = 60): Promise<boolean> {
    return this.kc.updateToken(minValidity);
  }

  getToken(): string | undefined {
    return this.kc.token;
  }

  isAuthenticated(): boolean {
    return this.kc.authenticated ?? false;
  }

  getRole(): Role {
    return extractRole(this.kc.tokenParsed?.realm_access?.roles ?? []);
  }

  getLocale(): 'fr' | 'en' {
    return (this.kc.tokenParsed?.['locale'] as 'fr' | 'en') ?? 'fr';
  }

  getUser() {
    if (!this.kc.tokenParsed) return null;
    const t = this.kc.tokenParsed;
    return {
      userId: t.sub ?? '',
      email: t['email'] as string | undefined,
      firstName: t['given_name'] as string | undefined,
      lastName: t['family_name'] as string | undefined,
      // AC6 Story 1.2d — exposed for FR17 (block transactional paths for unverified users).
      emailVerified: (t['email_verified'] as boolean | undefined) ?? false,
    };
  }

  getRawKeycloak(): Keycloak {
    return this.kc;
  }
}
