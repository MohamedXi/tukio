import { type DynamicModule, Global, Module } from '@nestjs/common';
import { IdentitySvcModule } from '../external/identity-svc/identity-svc.module.js';
import { KeycloakOAuthModule } from '../external/keycloak/keycloak-oauth.module.js';
import { LoginAuditModule } from '../external/login-audit/login-audit.module.js';
import { ConfigurationModule } from '../config/config.module.js';
import { EnvironmentConfigService } from '../config/environment-config.service.js';
import {
  IDENTITY_SVC_CLIENT,
  KEYCLOAK_OAUTH_CLIENT,
  LOGIN_AUDIT_EVENT_PUBLISHER,
} from '../../domain/ports/tokens.js';
import type { IIdentitySvcClient } from '../../domain/ports/identity-svc.port.js';
import type { ILoginAuditEventPublisher } from '../../domain/ports/login-audit-event-publisher.port.js';
import type { KeycloakOAuthClient } from '../external/keycloak/keycloak-oauth.client.js';
import { resolveCookieDeployment } from '../http/utils/cookie-helpers.js';
import { RegisterCustomerForwarder } from '../../usecases/register-customer.forwarder.js';
import { RegisterProForwarder } from '../../usecases/register-pro.forwarder.js';
import { InitiateLoginUseCase } from '../../usecases/auth/initiate-login.usecase.js';
import { HandleCallbackUseCase } from '../../usecases/auth/handle-callback.usecase.js';
import { RefreshTokenUseCase } from '../../usecases/auth/refresh-token.usecase.js';
import { LogoutUseCase } from '../../usecases/auth/logout.usecase.js';
import { WhoamiUseCase } from '../../usecases/auth/whoami.usecase.js';
import { UseCaseProxy } from './usecases-proxy.js';

/**
 * Story 1.2c + 1.3c + 1.4b — Pattern Pretre wiring (BFF flavour). Maps domain
 * ports → downstream-service-backed implementations, then exposes ready-to-
 * inject `UseCaseProxy` providers for controllers.
 */
export const REGISTER_CUSTOMER_FORWARDER = 'REGISTER_CUSTOMER_FORWARDER';
export type RegisterCustomerForwarderProxy =
  UseCaseProxy<RegisterCustomerForwarder>;

export const REGISTER_PRO_FORWARDER = 'REGISTER_PRO_FORWARDER';
export type RegisterProForwarderProxy = UseCaseProxy<RegisterProForwarder>;

// Story 1.4b — 5 auth use case proxies (Authorization Code + PKCE flow).
export const INITIATE_LOGIN_USECASES_PROXY = 'INITIATE_LOGIN_USECASES_PROXY';
export type InitiateLoginUseCaseProxy = UseCaseProxy<InitiateLoginUseCase>;

export const HANDLE_CALLBACK_USECASES_PROXY = 'HANDLE_CALLBACK_USECASES_PROXY';
export type HandleCallbackUseCaseProxy = UseCaseProxy<HandleCallbackUseCase>;

export const REFRESH_TOKEN_USECASES_PROXY = 'REFRESH_TOKEN_USECASES_PROXY';
export type RefreshTokenUseCaseProxy = UseCaseProxy<RefreshTokenUseCase>;

export const LOGOUT_USECASES_PROXY = 'LOGOUT_USECASES_PROXY';
export type LogoutUseCaseProxy = UseCaseProxy<LogoutUseCase>;

export const WHOAMI_USECASES_PROXY = 'WHOAMI_USECASES_PROXY';
export type WhoamiUseCaseProxy = UseCaseProxy<WhoamiUseCase>;

/**
 * Cookie domain attribute by environment:
 *  - production → `.tukio.one` so cookies are shared across apex + subdomains
 *  - dev/test  → null (cookies stay scoped to `localhost` / `127.0.0.1`)
 */
function cookieDomainFor(
  nodeEnv: 'development' | 'test' | 'production',
): string | null {
  return nodeEnv === 'production' ? '.tukio.one' : null;
}

@Global()
@Module({})
export class UseCasesProxyModule {
  static register(): DynamicModule {
    return {
      module: UseCasesProxyModule,
      imports: [
        IdentitySvcModule,
        KeycloakOAuthModule,
        LoginAuditModule,
        ConfigurationModule,
      ],
      providers: [
        {
          inject: [IDENTITY_SVC_CLIENT],
          provide: REGISTER_CUSTOMER_FORWARDER,
          useFactory: (
            client: IIdentitySvcClient,
          ): RegisterCustomerForwarderProxy =>
            new UseCaseProxy(new RegisterCustomerForwarder(client)),
        },
        {
          inject: [IDENTITY_SVC_CLIENT],
          provide: REGISTER_PRO_FORWARDER,
          useFactory: (client: IIdentitySvcClient): RegisterProForwarderProxy =>
            new UseCaseProxy(new RegisterProForwarder(client)),
        },
        {
          provide: INITIATE_LOGIN_USECASES_PROXY,
          inject: [KEYCLOAK_OAUTH_CLIENT, EnvironmentConfigService],
          useFactory: (
            oauthClient: KeycloakOAuthClient,
            config: EnvironmentConfigService,
          ): InitiateLoginUseCaseProxy => {
            const nodeEnv = config.getNodeEnv();
            return new UseCaseProxy(
              new InitiateLoginUseCase({
                oauthClient,
                stateJwtSecret: config.getStateJwtSecret(),
                pkceCookieSecret: config.getPkceCookieHmacSecret(),
                cookieDeployment: resolveCookieDeployment({
                  nodeEnv,
                  domain: cookieDomainFor(nodeEnv),
                  devInsecureFlag: config.isDevInsecureCookiesEnabled()
                    ? '1'
                    : undefined,
                }),
                isDev: nodeEnv === 'development',
              }),
            );
          },
        },
        {
          provide: HANDLE_CALLBACK_USECASES_PROXY,
          inject: [
            KEYCLOAK_OAUTH_CLIENT,
            LOGIN_AUDIT_EVENT_PUBLISHER,
            EnvironmentConfigService,
          ],
          useFactory: (
            oauthClient: KeycloakOAuthClient,
            auditPublisher: ILoginAuditEventPublisher,
            config: EnvironmentConfigService,
          ): HandleCallbackUseCaseProxy => {
            const nodeEnv = config.getNodeEnv();
            return new UseCaseProxy(
              new HandleCallbackUseCase({
                oauthClient,
                auditPublisher,
                stateJwtSecret: config.getStateJwtSecret(),
                pkceCookieSecret: config.getPkceCookieHmacSecret(),
                cookieDeployment: resolveCookieDeployment({
                  nodeEnv,
                  domain: cookieDomainFor(nodeEnv),
                  devInsecureFlag: config.isDevInsecureCookiesEnabled()
                    ? '1'
                    : undefined,
                }),
                zoneBaseUrls: config.getZoneBaseUrls(),
                isDev: nodeEnv === 'development',
              }),
            );
          },
        },
        {
          provide: REFRESH_TOKEN_USECASES_PROXY,
          inject: [KEYCLOAK_OAUTH_CLIENT, EnvironmentConfigService],
          useFactory: (
            oauthClient: KeycloakOAuthClient,
            config: EnvironmentConfigService,
          ): RefreshTokenUseCaseProxy => {
            const nodeEnv = config.getNodeEnv();
            return new UseCaseProxy(
              new RefreshTokenUseCase({
                oauthClient,
                cookieDeployment: resolveCookieDeployment({
                  nodeEnv,
                  domain: cookieDomainFor(nodeEnv),
                  devInsecureFlag: config.isDevInsecureCookiesEnabled()
                    ? '1'
                    : undefined,
                }),
              }),
            );
          },
        },
        {
          provide: LOGOUT_USECASES_PROXY,
          inject: [KEYCLOAK_OAUTH_CLIENT, EnvironmentConfigService],
          useFactory: (
            oauthClient: KeycloakOAuthClient,
            config: EnvironmentConfigService,
          ): LogoutUseCaseProxy => {
            const nodeEnv = config.getNodeEnv();
            return new UseCaseProxy(
              new LogoutUseCase({
                oauthClient,
                cookieDeployment: resolveCookieDeployment({
                  nodeEnv,
                  domain: cookieDomainFor(nodeEnv),
                  devInsecureFlag: config.isDevInsecureCookiesEnabled()
                    ? '1'
                    : undefined,
                }),
              }),
            );
          },
        },
        {
          provide: WHOAMI_USECASES_PROXY,
          useFactory: (): WhoamiUseCaseProxy =>
            new UseCaseProxy(new WhoamiUseCase()),
        },
      ],
      exports: [
        REGISTER_CUSTOMER_FORWARDER,
        REGISTER_PRO_FORWARDER,
        INITIATE_LOGIN_USECASES_PROXY,
        HANDLE_CALLBACK_USECASES_PROXY,
        REFRESH_TOKEN_USECASES_PROXY,
        LOGOUT_USECASES_PROXY,
        WHOAMI_USECASES_PROXY,
      ],
    };
  }
}
