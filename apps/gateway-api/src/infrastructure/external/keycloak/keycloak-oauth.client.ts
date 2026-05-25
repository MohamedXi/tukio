import { Logger } from '@nestjs/common';
import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import axiosRetry from 'axios-retry';
import type { Locale } from '@tukio/contracts';
import {
  KeycloakInvalidGrantError,
  KeycloakRefreshExpiredError,
  KeycloakRefreshInvalidError,
  KeycloakRefreshReusedError,
  KeycloakUnreachableError,
} from '../../../domain/exception/keycloak-oauth.exception.js';

const SCOPE = 'openid profile email tukio-locale-scope';
const TOKEN_TIMEOUT_MS = 10_000;
const TOKEN_RETRY_COUNT = 3;
const TOKEN_RETRY_BACKOFF_MS = [1_000, 3_000, 9_000];

export interface KeycloakOAuthClientConfig {
  url: string;
  realm: string;
  publicBaseUrl: string;
}

export interface BuildAuthorizeUrlInput {
  clientId: string;
  locale: Locale;
  challenge: string;
  state: string;
}

export interface ExchangeCodeInput {
  code: string;
  verifier: string;
  locale: Locale;
  clientId: string;
}

export interface RefreshTokensInput {
  refreshToken: string;
  clientId: string;
}

export interface RevokeSessionInput {
  refreshToken: string;
  clientId: string;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
  sessionState: string;
}

export interface RefreshedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

interface KeycloakTokenResponse {
  access_token: string;
  refresh_token: string;
  id_token?: string;
  expires_in: number;
  refresh_expires_in: number;
  session_state?: string;
}

interface KeycloakErrorResponse {
  error?: string;
  error_description?: string;
}

export class KeycloakOAuthClient {
  private readonly http: AxiosInstance;
  private readonly normalizedPublicBaseUrl: string;
  // P14: use static logger (no DI injection needed for infra adapter logging)
  private readonly logger = new Logger(KeycloakOAuthClient.name);

  constructor(private readonly config: KeycloakOAuthClientConfig) {
    // P14: strip trailing slash to prevent double-slash redirect_uri
    this.normalizedPublicBaseUrl = config.publicBaseUrl.replace(/\/+$/, '');

    this.http = axios.create({
      baseURL: this.realmBaseUrl(),
      timeout: TOKEN_TIMEOUT_MS,
      validateStatus: (status) => status >= 200 && status < 300,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    // P1: only retry on explicit 5xx responses — never on network errors.
    // Authorization code exchange is non-idempotent: a code consumed by
    // Keycloak before a TCP drop would return `invalid_grant` on retry,
    // indistinguishable from a genuine code-reuse attack.
    axiosRetry(this.http, {
      retries: TOKEN_RETRY_COUNT,
      retryDelay: (retryCount) =>
        TOKEN_RETRY_BACKOFF_MS[retryCount - 1] ?? 9_000,
      retryCondition: (err) =>
        err.response?.status !== undefined && err.response.status >= 500,
    });
  }

  buildAuthorizeUrl(input: BuildAuthorizeUrlInput): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: input.clientId,
      redirect_uri: `${this.normalizedPublicBaseUrl}/${input.locale}/auth/callback`,
      code_challenge: input.challenge,
      code_challenge_method: 'S256',
      state: input.state,
      kc_locale: input.locale,
      scope: SCOPE,
    });
    return `${this.realmBaseUrl()}/protocol/openid-connect/auth?${params.toString()}`;
  }

  async exchangeCodeForTokens(input: ExchangeCodeInput): Promise<OAuthTokens> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: input.code,
      redirect_uri: `${this.normalizedPublicBaseUrl}/${input.locale}/auth/callback`,
      client_id: input.clientId,
      code_verifier: input.verifier,
    });
    try {
      const response = await this.http.post<KeycloakTokenResponse>(
        '/protocol/openid-connect/token',
        body.toString(),
      );
      return mapTokens(response);
    } catch (err) {
      throw mapTokenError(err, 'exchange');
    }
  }

  async refreshTokens(input: RefreshTokensInput): Promise<RefreshedTokens> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: input.refreshToken,
      client_id: input.clientId,
    });
    try {
      const response = await this.http.post<KeycloakTokenResponse>(
        '/protocol/openid-connect/token',
        body.toString(),
      );
      return mapRefreshedTokens(response);
    } catch (err) {
      throw mapTokenError(err, 'refresh');
    }
  }

  async revokeSession(input: RevokeSessionInput): Promise<void> {
    const body = new URLSearchParams({
      refresh_token: input.refreshToken,
      client_id: input.clientId,
    });
    try {
      await this.http.post('/protocol/openid-connect/logout', body.toString());
    } catch (err) {
      if (
        axios.isAxiosError(err) &&
        err.response &&
        err.response.status < 500
      ) {
        // P12: warn on 4xx — a 401 invalid_client here means client_id is wrong,
        // not just an already-revoked token. Session may still be active in KC.
        this.logger.warn(
          {
            status: err.response.status,
            error: (err.response.data as KeycloakErrorResponse)?.error,
          },
          'Keycloak revokeSession returned 4xx — session may remain active',
        );
        return;
      }
      throw mapTokenError(err, 'revoke');
    }
  }

  private realmBaseUrl(): string {
    return `${this.config.url}/realms/${this.config.realm}`;
  }
}

function mapTokens(
  response: AxiosResponse<KeycloakTokenResponse>,
): OAuthTokens {
  const data = response.data;
  if (!data?.access_token || !data.refresh_token || !data.id_token) {
    throw new KeycloakUnreachableError(
      'Keycloak token response missing required token fields',
    );
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    idToken: data.id_token,
    expiresIn: data.expires_in,
    refreshExpiresIn: data.refresh_expires_in,
    sessionState: data.session_state ?? '',
  };
}

function mapRefreshedTokens(
  response: AxiosResponse<KeycloakTokenResponse>,
): RefreshedTokens {
  const data = response.data;
  if (!data?.access_token || !data.refresh_token) {
    throw new KeycloakUnreachableError(
      'Keycloak refresh response missing required token fields',
    );
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    refreshExpiresIn: data.refresh_expires_in,
  };
}

function mapTokenError(
  err: unknown,
  operation: 'exchange' | 'refresh' | 'revoke',
): Error {
  if (!axios.isAxiosError(err)) {
    const message =
      err instanceof Error ? err.message : 'Unknown Keycloak error';
    return new KeycloakUnreachableError(message, err);
  }

  const status = err.response?.status;
  const body = (err.response?.data ?? {}) as KeycloakErrorResponse;
  const code = body.error;
  const detail = body.error_description ?? body.error ?? err.message;

  if (status === undefined) {
    return new KeycloakUnreachableError(
      `Keycloak network failure: ${err.message}`,
      err,
    );
  }

  if (status >= 500) {
    return new KeycloakUnreachableError(
      `Keycloak responded ${status}: ${detail}`,
      err,
    );
  }

  // P7: malformed / unparseable refresh token → AUTH-REFRESH-INVALID-001
  if (status === 400 && code === 'invalid_token' && operation === 'refresh') {
    return new KeycloakRefreshInvalidError(detail);
  }

  if (status === 400 && code === 'invalid_grant') {
    if (operation === 'refresh') {
      const description = detail.toLowerCase();
      if (description.includes('stale') || description.includes('not active')) {
        return new KeycloakRefreshReusedError(detail);
      }
      return new KeycloakRefreshExpiredError(detail);
    }
    return new KeycloakInvalidGrantError(detail);
  }

  if (status === 401) {
    return new KeycloakInvalidGrantError(`Keycloak unauthorized: ${detail}`);
  }

  if (status === 429) {
    return new KeycloakUnreachableError(
      `Keycloak rate-limited (429): ${detail}`,
      err,
    );
  }

  return new KeycloakUnreachableError(
    `Keycloak responded ${status}: ${detail}`,
    err,
  );
}
