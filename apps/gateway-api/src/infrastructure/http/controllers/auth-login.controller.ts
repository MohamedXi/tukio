import { createHash } from 'node:crypto';
import {
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Ip,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@tukio/auth/decorators/public';
import { CurrentActor } from '@tukio/auth/decorators/current-actor';
import type { BackendActor } from '@tukio/auth/types';

// Structural ReplyLike shape — avoids declaring `fastify` as a direct dep
// (it arrives transitively via @nestjs/platform-fastify). Mirrors auth-pro
// controller's MultipartHttpRequest pattern.
interface ReplyLike {
  header: (name: string, value: string | string[]) => unknown;
  redirect: (url: string, code?: number) => unknown;
}
import type { WhoamiResponseDto } from '@tukio/contracts/dtos/identity/whoami-response';
import type { Locale } from '@tukio/contracts';
import { Cookies } from '../decorators/cookies.decorator.js';
import { AuthCsrfMismatchException } from '../../../domain/exception/auth-csrf-mismatch.exception.js';
import { EnvironmentConfigService } from '../../config/environment-config.service.js';
import {
  HANDLE_CALLBACK_USECASES_PROXY,
  type HandleCallbackUseCaseProxy,
  INITIATE_LOGIN_USECASES_PROXY,
  type InitiateLoginUseCaseProxy,
  LOGOUT_USECASES_PROXY,
  type LogoutUseCaseProxy,
  REFRESH_TOKEN_USECASES_PROXY,
  type RefreshTokenUseCaseProxy,
  WHOAMI_USECASES_PROXY,
  type WhoamiUseCaseProxy,
} from '../../usecases-proxy/usecases-proxy.module.js';
import { CsrfGuard } from '../guards/csrf.guard.js';
import { COOKIE_NAMES } from '../utils/cookie-helpers.js';

const ALLOWED_CLIENT_IDS = new Set(['tukio-web', 'tukio-admin']);
const REFRESH_COOKIE = COOKIE_NAMES.REFRESH_TOKEN;
const PKCE_COOKIE = COOKIE_NAMES.PKCE_STATE;
const CSRF_COOKIE = COOKIE_NAMES.CSRF_TOKEN;

/**
 * Story 1.4b AC6 — login endpoints (Authorization Code + PKCE).
 *
 * Endpoint map:
 *   GET  /v1/auth/login    — initiate (302 redirect to Keycloak)
 *   GET  /v1/auth/callback — exchange (302 redirect to post-login destination)
 *   POST /v1/auth/refresh  — rotation (200 JSON envelope, CsrfGuard)
 *   POST /v1/auth/logout   — revoke   (200 JSON envelope, CsrfGuard)
 *   GET  /v1/auth/whoami   — session  (200 JSON envelope, KeycloakJwtGuard)
 *
 * Cookies are emitted directly via `reply.header('Set-Cookie', [...])` so the
 * global response envelope leaves HTTP framing alone.
 */
@Controller({ path: 'auth', version: '1' })
export class AuthLoginController {
  constructor(
    @Inject(INITIATE_LOGIN_USECASES_PROXY)
    private readonly initiateProxy: InitiateLoginUseCaseProxy,
    @Inject(HANDLE_CALLBACK_USECASES_PROXY)
    private readonly callbackProxy: HandleCallbackUseCaseProxy,
    @Inject(REFRESH_TOKEN_USECASES_PROXY)
    private readonly refreshProxy: RefreshTokenUseCaseProxy,
    @Inject(LOGOUT_USECASES_PROXY)
    private readonly logoutProxy: LogoutUseCaseProxy,
    @Inject(WHOAMI_USECASES_PROXY)
    private readonly whoamiProxy: WhoamiUseCaseProxy,
    private readonly config: EnvironmentConfigService,
  ) {}

  @Public()
  @Get('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(
    @Query('next') next: string | undefined,
    @Query('client_id') clientIdRaw: string | undefined,
    @Query('locale') localeRaw: string | undefined,
    @Res({ passthrough: false }) reply: ReplyLike,
  ): Promise<void> {
    const clientId = ALLOWED_CLIENT_IDS.has(clientIdRaw ?? '')
      ? (clientIdRaw as string)
      : this.config.getKeycloakOAuthClients().web;
    const locale: Locale = localeRaw === 'en' ? 'en' : 'fr';

    const { redirectUrl, pkceCookie } = await this.initiateProxy
      .getInstance()
      .execute({ next: next ?? null, clientId, locale });

    reply.header('Set-Cookie', [pkceCookie]);
    reply.redirect(redirectUrl, 302);
  }

  @Public()
  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('locale') localeRaw: string | undefined,
    @Cookies(PKCE_COOKIE) pkceCookie: string | undefined,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: false }) reply: ReplyLike,
  ): Promise<void> {
    const locale: Locale = localeRaw === 'en' ? 'en' : 'fr';
    if (!code || !state) {
      const fallback = `${this.config.getZoneBaseUrls().public}/${locale}/auth/login?error=invalid_request`;
      reply.redirect(fallback, 302);
      return;
    }
    const clientId = this.config.getKeycloakOAuthClients().web;
    const ipHash = sha256Hex(ip);
    const userAgentHash = sha256Hex(userAgent ?? '');

    const { redirectUrl, sessionCookies, clearPkceCookie } =
      await this.callbackProxy.getInstance().execute({
        code,
        state,
        locale,
        pkceCookie,
        clientId,
        ipHash,
        userAgentHash,
      });

    reply.header('Set-Cookie', [...sessionCookies, clearPkceCookie]);
    reply.redirect(redirectUrl, 302);
  }

  @Public()
  @Post('refresh')
  @UseGuards(CsrfGuard)
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async refresh(
    @Cookies(REFRESH_COOKIE) refreshToken: string | undefined,
    @Cookies(CSRF_COOKIE) csrfToken: string | undefined,
    @Res({ passthrough: true }) reply: ReplyLike,
  ): Promise<{ expiresIn: number; refreshExpiresIn: number }> {
    if (!refreshToken || !csrfToken) {
      // CsrfGuard rejects upstream when CSRF header/cookie are missing; this
      // arm covers the case where the refresh-token cookie is missing but the
      // CSRF pair was present — also treated as a CSRF failure (no session).
      throw new AuthCsrfMismatchException('Refresh cookie missing');
    }
    const clientId = this.config.getKeycloakOAuthClients().web;
    const { sessionCookies, expiresIn, refreshExpiresIn } =
      await this.refreshProxy.getInstance().execute({
        refreshToken,
        csrfToken,
        clientId,
      });
    reply.header('Set-Cookie', sessionCookies);
    return { expiresIn, refreshExpiresIn };
  }

  @Public()
  @Post('logout')
  @UseGuards(CsrfGuard)
  @HttpCode(200)
  async logout(
    @Cookies(REFRESH_COOKIE) refreshToken: string | undefined,
    @Res({ passthrough: true }) reply: ReplyLike,
  ): Promise<{ ok: true }> {
    const clientId = this.config.getKeycloakOAuthClients().web;
    const { clearCookies } = await this.logoutProxy
      .getInstance()
      .execute({ refreshToken, clientId });
    reply.header('Set-Cookie', clearCookies);
    return { ok: true };
  }

  @Get('whoami')
  whoami(@CurrentActor() actor: BackendActor): WhoamiResponseDto {
    return this.whoamiProxy.getInstance().execute({ actor });
  }
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
