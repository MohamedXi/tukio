import { createHash } from 'node:crypto';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import KcAdminClient from '@keycloak/keycloak-admin-client';
import {
  type IKeycloakAdmin,
  type CreateKeycloakUserInput,
  type CreateKeycloakUserResult,
  KeycloakUserAlreadyExistsError,
  KeycloakUnreachableError,
} from '../../../domain/ports/keycloak-admin.port.js';
import type { IConfigService } from '../../../domain/ports/config.port.js';
import type { ILogger } from '../../../domain/ports/logger.port.js';
import type { UserRole } from '../../../domain/model/user-role.enum.js';
import { CONFIG_SERVICE, LOGGER } from '../../../domain/ports/tokens.js';

/**
 * Mapping between the tukio `UserRole` const and the Keycloak realm-role name
 * provisioned by Story 1.1. Keep aligned with the bootstrap realm export.
 */
const ROLE_NAME_BY_TUKIO_ROLE: Record<UserRole, string> = {
  client: 'client',
  pro: 'pro',
  'admin-support': 'admin-support',
  'admin-modo': 'admin-modo',
  'admin-super': 'admin-super',
};

/**
 * KeycloakAdminService — Pretre infrastructure adapter (Story 1.2b).
 *
 * Wraps `@keycloak/keycloak-admin-client` (Keycloak 26 compat) to expose the
 * `IKeycloakAdmin` domain port. Library-specific errors are translated to the
 * domain-level `KeycloakUserAlreadyExistsError` / `KeycloakUnreachableError`
 * so the use case stays Pretre-pure (Story 1.2a).
 *
 * Auth via `clientCredentials` grant against the `tukio-api` confidential
 * client (Story 1.1). The library handles token refresh internally.
 *
 * **NFR16 PII redaction** : the password received in `createUser` transits via
 * TLS only and is NEVER logged at any level — see `redactCreateUserInput`.
 */
@Injectable()
export class KeycloakAdminService implements IKeycloakAdmin, OnModuleInit {
  private readonly client: KcAdminClient;
  private readonly realm: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  /**
   * Cache of realm-role representations by name (the Keycloak Admin API requires
   * passing the full RoleRepresentation, not just the name). Lazily populated.
   */
  private readonly roleCache = new Map<string, { id: string; name: string }>();

  constructor(
    @Inject(CONFIG_SERVICE) private readonly config: IConfigService,
    @Inject(LOGGER) private readonly logger: ILogger,
  ) {
    const adminConfig = this.config.getKeycloakAdminConfig();
    this.realm = adminConfig.realm;
    this.clientId = adminConfig.clientId;
    this.clientSecret = adminConfig.clientSecret;
    this.client = new KcAdminClient({
      baseUrl: adminConfig.url,
      realmName: adminConfig.realm,
    });
  }

  async onModuleInit(): Promise<void> {
    // Review patch P8 (1.2b) — eager auth at boot with bounded retry so a
    // cold-start race against Keycloak (container not yet healthy) doesn't
    // kill the liveness probe. After exhaustion, a stale secret still fails
    // the deploy. Backoff : 1s, 2s, 4s. Total ≤ 7s before giving up.
    const RETRY_DELAYS_MS = [1_000, 2_000, 4_000];
    let lastErr: unknown;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        await this.authenticate();
        return;
      } catch (err) {
        lastErr = err;
        if (attempt === RETRY_DELAYS_MS.length) break;
        this.logger.warn('Keycloak auth at boot failed — retrying', {
          attempt: attempt + 1,
          nextDelayMs: RETRY_DELAYS_MS[attempt],
        });
        const delay = RETRY_DELAYS_MS[attempt] ?? 0;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  async createUser(
    input: CreateKeycloakUserInput,
  ): Promise<CreateKeycloakUserResult> {
    await this.ensureAuthenticated();
    let keycloakUserId: string | undefined;
    try {
      // Keycloak Admin API `users.create` returns `{ id }` derived from the
      // response Location header. The library handles the parsing.
      const created = await this.client.users.create({
        realm: this.realm,
        username: input.email,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        enabled: true,
        emailVerified: input.emailVerified,
        attributes: {
          locale: [input.locale],
          'tukio:locale': [input.locale],
          'tukio:status': [input.status],
        },
        credentials: [
          {
            type: 'password',
            value: input.password,
            temporary: false,
          },
        ],
      });
      // Review patch (1.2b) — defensive : library may return without an id
      // if Keycloak's Location header is missing (proxy quirk). Fail loudly
      // instead of propagating `undefined` to downstream calls.
      if (!created?.id) {
        throw new KeycloakUnreachableError(
          'Keycloak users.create succeeded but returned no id (Location header missing or malformed)',
        );
      }
      keycloakUserId = created.id;
    } catch (err) {
      throw this.translate(err, {
        operation: 'createUser',
        email: input.email,
      });
    }
    // Review patch P6 (1.2b) — assign role OUTSIDE the create try/catch so
    // a failure here triggers an inner compensation : the Keycloak user
    // exists with no role, the caller would otherwise see a thrown error
    // without a `keycloakUserId` to compensate from. Inner compensation
    // tries to delete the orphan; swallow that error so the original
    // translated error reaches the caller.
    try {
      await this.assignRealmRole(keycloakUserId, input.role);
    } catch (roleErr) {
      await this.client.users
        .del({ realm: this.realm, id: keycloakUserId })
        .catch((delErr: unknown) => {
          this.logger.warn(
            'Keycloak inner compensation deleteUser failed — orphan user without role',
            {
              keycloakUserId,
              roleName: ROLE_NAME_BY_TUKIO_ROLE[input.role],
              deleteError:
                delErr instanceof Error ? delErr.message : String(delErr),
              drift: 'R8-inner',
              followUp:
                'tukio_keycloak_orphan_users_total + Story 1.10 daily reconciliation',
            },
          );
        });
      throw this.translate(roleErr, {
        operation: 'createUser.assignRealmRole',
        email: input.email,
        keycloakUserId,
      });
    }
    return { keycloakUserId };
  }

  async findUserByEmail(
    email: string,
  ): Promise<{ keycloakUserId: string } | null> {
    await this.ensureAuthenticated();
    try {
      const users = await this.client.users.find({
        realm: this.realm,
        email,
        exact: true,
      });
      if (users.length === 0) return null;
      const id = users[0]?.id;
      if (!id) return null;
      return { keycloakUserId: id };
    } catch (err) {
      throw this.translate(err, { operation: 'findUserByEmail', email });
    }
  }

  async deleteUser(keycloakUserId: string): Promise<void> {
    await this.ensureAuthenticated();
    try {
      await this.client.users.del({ realm: this.realm, id: keycloakUserId });
    } catch (err) {
      throw this.translate(err, { operation: 'deleteUser', keycloakUserId });
    }
  }

  async setUserPassword(
    keycloakUserId: string,
    password: string,
    temporary: boolean,
  ): Promise<void> {
    await this.ensureAuthenticated();
    try {
      await this.client.users.resetPassword({
        realm: this.realm,
        id: keycloakUserId,
        credential: { type: 'password', value: password, temporary },
      });
    } catch (err) {
      throw this.translate(err, {
        operation: 'setUserPassword',
        keycloakUserId,
      });
    }
  }

  async assignRealmRole(keycloakUserId: string, role: UserRole): Promise<void> {
    await this.ensureAuthenticated();
    const roleName = ROLE_NAME_BY_TUKIO_ROLE[role];
    try {
      const roleRep = await this.getRoleRepresentation(roleName);
      await this.client.users.addRealmRoleMappings({
        realm: this.realm,
        id: keycloakUserId,
        roles: [roleRep],
      });
    } catch (err) {
      throw this.translate(err, {
        operation: 'assignRealmRole',
        keycloakUserId,
        roleName,
      });
    }
  }

  async setUserAttributes(
    keycloakUserId: string,
    attributes: Record<string, readonly string[]>,
  ): Promise<void> {
    await this.ensureAuthenticated();
    try {
      // Keycloak `users.update` performs a full replace of `attributes`, so the
      // caller must pass the complete map of attributes they want persisted.
      // Convert readonly arrays to mutable arrays for the library type.
      const mutable: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(attributes)) {
        mutable[k] = [...v];
      }
      await this.client.users.update(
        { realm: this.realm, id: keycloakUserId },
        { attributes: mutable },
      );
    } catch (err) {
      throw this.translate(err, {
        operation: 'setUserAttributes',
        keycloakUserId,
      });
    }
  }

  /**
   * Track the access-token expiry locally so `ensureAuthenticated` can refresh
   * BEFORE the library returns a 401. Review patch (1.2b) — the underlying
   * `@keycloak/keycloak-admin-client` does NOT auto-refresh `client_credentials`
   * grants after TTL (typically 5min in Keycloak default config). Without local
   * tracking, the first call after idle TTL returns 401 → bucketed as
   * `KeycloakUnreachableError` → pod throws until restart.
   */
  private tokenExpiresAtMs = 0;
  /** Refresh access token 60s before the library reports it as expired. */
  private static readonly TOKEN_REFRESH_BUFFER_MS = 60_000;

  private async authenticate(): Promise<void> {
    try {
      const result: unknown = await this.client.auth({
        grantType: 'client_credentials',
        clientId: this.clientId,
        clientSecret: this.clientSecret,
      });
      // Library's `auth` returns void in its TS types but in practice yields
      // a token-response object at runtime. We treat the result defensively :
      // if `expiresIn` isn't present, fall back to Keycloak's documented
      // default (5min = 300s). Refresh kicks in 60s before expiry.
      const expiresInSec =
        typeof result === 'object' &&
        result !== null &&
        typeof (result as { expiresIn?: unknown }).expiresIn === 'number'
          ? (result as { expiresIn: number }).expiresIn
          : 300;
      this.tokenExpiresAtMs = Date.now() + expiresInSec * 1000;
    } catch (err) {
      this.tokenExpiresAtMs = 0;
      throw this.translate(err, { operation: 'authenticate' });
    }
  }

  private async ensureAuthenticated(): Promise<void> {
    const now = Date.now();
    const needsRefresh =
      !this.client.accessToken ||
      this.tokenExpiresAtMs - KeycloakAdminService.TOKEN_REFRESH_BUFFER_MS <=
        now;
    if (needsRefresh) {
      await this.authenticate();
    }
  }

  private async getRoleRepresentation(
    name: string,
  ): Promise<{ id: string; name: string }> {
    const cached = this.roleCache.get(name);
    if (cached) return cached;
    const role = await this.client.roles.findOneByName({
      realm: this.realm,
      name,
    });
    if (!role || !role.id || !role.name) {
      throw new KeycloakUnreachableError(
        `Realm role '${name}' not found in realm '${this.realm}' — verify Story 1.1 realm bootstrap`,
      );
    }
    const rep = { id: role.id, name: role.name };
    this.roleCache.set(name, rep);
    return rep;
  }

  /**
   * Translate library-specific errors into domain-level errors so the use
   * case stays infrastructure-agnostic. The `@keycloak/keycloak-admin-client`
   * library throws fetch-style errors with `response.status` or wrapped
   * `AxiosError`-shaped errors depending on the underlying HTTP client.
   */
  private translate(err: unknown, context: Record<string, unknown>): Error {
    const status = extractHttpStatus(err);
    if (status === 409) {
      // Operation-specific conflict — most commonly username/email already exists.
      const emailValue = context.email;
      const emailForError =
        typeof emailValue === 'string' ? emailValue : 'unknown';
      return new KeycloakUserAlreadyExistsError(emailForError);
    }
    // 5xx, network/timeout, or auth failures (401/403 after retry) are all
    // bucketed as "Keycloak unreachable" for the use case layer.
    if (
      status === undefined ||
      status >= 500 ||
      status === 401 ||
      status === 403
    ) {
      // Review patch P10 (1.2b) — PII redaction NFR16. Replace raw `email`
      // in the log metadata with a short hash so the operator can correlate
      // across logs without exposing the user's address. Same for any other
      // potentially-PII context field.
      const safeContext = redactPii(context);
      this.logger.warn(
        'Keycloak Admin API call failed — treating as unreachable',
        {
          ...safeContext,
          status: status ?? 'no-status',
        },
      );
      return new KeycloakUnreachableError(
        `Keycloak Admin API call failed in operation '${String(context.operation)}'`,
        err,
      );
    }
    // 4xx other than 409 — these are client errors not expected at the
    // boundary (the use case has already validated input). Re-throw verbatim
    // so the global exception filter logs the raw cause.
    return err instanceof Error ? err : new Error(String(err));
  }
}

/** Best-effort extraction of an HTTP status code from heterogenous library errors. */
function extractHttpStatus(err: unknown): number | undefined {
  if (err === null || typeof err !== 'object') return undefined;
  const e = err as Record<string, unknown>;
  if (typeof e.response === 'object' && e.response !== null) {
    const r = e.response as Record<string, unknown>;
    if (typeof r.status === 'number') return r.status;
  }
  if (typeof e.status === 'number') return e.status;
  if (typeof e.statusCode === 'number') return e.statusCode;
  return undefined;
}

/**
 * Replace PII fields in log context with short hashes so operators can
 * correlate without leaking raw user data (NFR16). Review patch P10 (1.2b).
 * The 8-char hex prefix is a small enough collision risk for ad-hoc log
 * correlation while making PII reconstruction infeasible.
 */
function redactPii(context: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...context };
  if (typeof context.email === 'string') {
    delete out.email;
    out.emailHash = createHash('sha256')
      .update(context.email.trim().toLowerCase())
      .digest('hex')
      .slice(0, 8);
  }
  return out;
}
