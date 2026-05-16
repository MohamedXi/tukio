import { randomUUID } from 'node:crypto';
import type { Locale } from '@tukio/contracts/types/Locale';
import {
  IdentityErrorCodes,
  type IdentityErrorCode,
} from '@tukio/contracts/types/error-codes';
import { type Actor, SYSTEM_ACTOR_USER_ID } from '@tukio/contracts/types/Actor';
import type { UserRegisteredV1 } from '@tukio/contracts/events/identity/user-registered.v1';
import type { EmailSendV1 } from '@tukio/contracts/events/notification/email-send.v1';
import { Email } from '../domain/model/email.value-object.js';
import { UserProfile } from '../domain/model/user-profile.aggregate.js';
import { UserRole } from '../domain/model/user-role.enum.js';
import { UserStatus } from '../domain/model/user-status.enum.js';
import type { IUserProfileRepository } from '../domain/ports/user-profile.repository.port.js';
import type { ILogger } from '../domain/ports/logger.port.js';
import {
  type IKeycloakAdmin,
  KeycloakUserAlreadyExistsError,
  KeycloakUnreachableError,
} from '../domain/ports/keycloak-admin.port.js';
import { IdentityConflictException } from '../domain/exception/identity-conflict.exception.js';
import { ExternalServiceException } from '../domain/exception/external-service.exception.js';

/**
 * Input received by the use case (already validated upstream by the gateway-api
 * `ZodValidationPipe` against `RegisterCustomerInputSchema` from
 * `@tukio/contracts/dtos/identity/register-customer`). The acquisition payload
 * has been merged by the gateway with the `tk_acq` cookie (first-touch wins).
 */
export interface RegisterCustomerUseCaseInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  locale: Locale;
  acceptTerms: true;
  /**
   * Always a boolean at this layer — Zod `RegisterCustomerInputSchema.acceptMarketing`
   * applies the `.default(false)` at the contract boundary (review patch P11
   * removes the use-case-side fallback to avoid hiding which layer defaults).
   */
  acceptMarketing: boolean;
  acquisition?: {
    source?:
      | 'organic'
      | 'google_ads'
      | 'meta_ads'
      | 'referral'
      | 'direct'
      | 'partner'
      | 'unknown';
    medium?: string;
    campaign?: string;
    content?: string;
    term?: string;
    referralId?: string;
  };
  /**
   * Correlation propagated from the gateway-api `X-Tukio-Correlation-Id` header
   * (Story 0.7). When undefined, the use case generates one so events still
   * carry a stable id for tracing.
   */
  correlationId?: string;
}

export interface RegisterCustomerUseCaseResult {
  userId: string;
  requiresEmailVerification: true;
}

const VERIFY_TOKEN_TTL_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const COMPENSATION_TIMEOUT_MS = 5_000;
/** Postgres SQLSTATE for unique_violation — surfaced by TypeORM `QueryFailedError.code`. */
const PG_UNIQUE_VIOLATION_CODE = '23505';

/**
 * Pattern Pretre — pure use case, NO NestJS decorators here.
 * Wiring happens in `infrastructure/usecases-proxy/usecases-proxy.module.ts`
 * (Story 1.2b: `REGISTER_CUSTOMER_USECASES_PROXY`).
 */
export class RegisterCustomerUseCase {
  constructor(
    private readonly userProfileRepo: IUserProfileRepository,
    private readonly keycloakAdmin: IKeycloakAdmin,
    private readonly logger: ILogger,
    private readonly publicBaseUrl: string,
    private readonly now: () => Date = () => new Date(),
    private readonly newUuid: () => string = () => randomUUID(),
  ) {}

  async execute(
    input: RegisterCustomerUseCaseInput,
  ): Promise<RegisterCustomerUseCaseResult> {
    // Single timestamp for the whole request — used for aggregate createdAt,
    // token expiry computation, and both event occurredAt values, so the audit
    // trail joins consistently (review patch P5).
    const now = this.now();

    const emailVo = Email.create(input.email);
    const emailString = emailVo.asString;

    // 1. Pre-check email pas déjà utilisé en DB locale (source de vérité business).
    //    Anti-énumération NFR9 : message API distinct, UI générique côté frontend (1.2d).
    const existing = await this.userProfileRepo.findByEmail(emailString);
    if (existing !== null) {
      throw this.conflict(
        IdentityErrorCodes.CONFLICT_EMAIL_EXISTS,
        'Email already registered',
      );
    }

    // 2. Création Keycloak user. Le password en clair transite via TLS uniquement
    //    (NFR9) et n'est JAMAIS loggé (NFR16 PII redaction). Keycloak hashe via
    //    sa policy realm-level (Story 1.1).
    let keycloakUserId: string;
    try {
      const result = await this.keycloakAdmin.createUser({
        email: emailString,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        password: input.password,
        locale: input.locale,
        emailVerified: false,
        role: UserRole.CLIENT,
        status: UserStatus.ACTIVE,
      });
      keycloakUserId = result.keycloakUserId;
    } catch (err) {
      if (err instanceof KeycloakUserAlreadyExistsError) {
        // Race condition : business DB check OK but Keycloak already has user
        // (drift R8 edge — Story 1.10 reconciliation job).
        throw this.conflict(
          IdentityErrorCodes.CONFLICT_EMAIL_EXISTS,
          'Email already registered',
        );
      }
      if (err instanceof KeycloakUnreachableError) {
        throw this.external(
          IdentityErrorCodes.EXTERNAL_KEYCLOAK_DOWN,
          'Keycloak unreachable',
        );
      }
      throw err;
    }

    // 3. Build aggregate + token + transactional save with outbox (Story 0.7).
    const correlationId = input.correlationId ?? this.newUuid();
    try {
      // Inject the user id via newUuid (vs default randomUUID inside the
      // aggregate) so unit tests get deterministic ids.
      const userProfile = UserProfile.register({
        id: this.newUuid(),
        keycloakUserId,
        email: emailVo,
        firstName: input.firstName,
        lastName: input.lastName,
        locale: input.locale,
        marketingOptIn: input.acceptMarketing,
        ...(input.acquisition && { acquisition: input.acquisition }),
        now,
      });

      const verifyToken = this.newUuid();
      const tokenExpiresAt = new Date(
        now.getTime() + VERIFY_TOKEN_TTL_DAYS * MS_PER_DAY,
      );

      await this.userProfileRepo.runInTransaction(async (txn) => {
        await txn.userProfileRepo.save(userProfile);
        await txn.tokenRepo.save({
          token: verifyToken,
          userId: userProfile.id,
          expiresAt: tokenExpiresAt,
        });

        const userRegisteredEvent = this.buildUserRegisteredEvent({
          userProfile,
          correlationId,
          occurredAt: now,
        });
        await txn.eventPublisher.publish(userRegisteredEvent);

        const emailSendEvent = this.buildEmailSendEvent({
          userProfile,
          verifyToken,
          tokenExpiresAt,
          correlationId,
          occurredAt: now,
        });
        await txn.eventPublisher.publish(emailSendEvent);
      });

      return { userId: userProfile.id, requiresEmailVerification: true };
    } catch (err) {
      // Review patch P6 — concurrent register race : if the DB unique index on
      // lower(email) trips (1.2b migration), translate the raw Postgres
      // `23505` error into a 409 IdentityConflictException so the caller sees
      // the right tukioCode instead of a 500. The compensation below still
      // fires to clean up the orphaned Keycloak user.
      if (isPgUniqueViolation(err)) {
        await this.compensateKeycloak(keycloakUserId, correlationId);
        throw this.conflict(
          IdentityErrorCodes.CONFLICT_EMAIL_EXISTS,
          'Email already registered',
        );
      }
      // Compensation : rollback Keycloak user if business save failed
      // (drift R8 mitigation — Story 1.10 daily reconciliation handles the
      // residual edge where compensation itself fails).
      await this.compensateKeycloak(keycloakUserId, correlationId);
      throw err;
    }
  }

  /**
   * Best-effort Keycloak rollback with timeout + structured logging.
   * - Wraps `deleteUser` in `Promise.race` so a hanging Keycloak doesn't
   *   stall the request thread indefinitely (review patch P3).
   * - On failure (timeout OR delete error), emits a `warn` log so the orphan
   *   is forensically discoverable today, instead of waiting for the
   *   Story 1.10 `tukio_keycloak_orphan_users_total` Prom counter (P2).
   * - Swallows any error so the caller still sees the original business error.
   */
  private async compensateKeycloak(
    keycloakUserId: string,
    correlationId: string,
  ): Promise<void> {
    try {
      await Promise.race([
        this.keycloakAdmin.deleteUser(keycloakUserId),
        new Promise<never>((_resolve, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  `Keycloak compensation deleteUser timed out after ${COMPENSATION_TIMEOUT_MS}ms`,
                ),
              ),
            COMPENSATION_TIMEOUT_MS,
          ),
        ),
      ]);
    } catch (compensationErr) {
      const errMessage =
        compensationErr instanceof Error
          ? compensationErr.message
          : String(compensationErr);
      this.logger.warn(
        'Keycloak rollback compensation failed — orphan user requires reconciliation',
        {
          keycloakUserId,
          correlationId,
          compensationError: errMessage,
          drift: 'R8',
          followUp:
            'tukio_keycloak_orphan_users_total + Story 1.10 daily reconciliation',
        },
      );
    }
  }

  private conflict(
    code: IdentityErrorCode,
    message: string,
  ): IdentityConflictException {
    return new IdentityConflictException(code, message);
  }

  private external(
    code: IdentityErrorCode,
    message: string,
  ): ExternalServiceException {
    return new ExternalServiceException(code, message);
  }

  private buildUserRegisteredEvent(args: {
    userProfile: UserProfile;
    correlationId: string;
    occurredAt: Date;
  }): UserRegisteredV1 {
    const { userProfile, correlationId, occurredAt } = args;
    const actor: Actor = {
      userId: userProfile.id,
      role: UserRole.CLIENT,
      locale: userProfile.locale,
    };
    return {
      eventId: this.newUuid(),
      eventType: 'identity.user.registered.v1',
      eventVersion: 'v1',
      occurredAt: occurredAt.toISOString(),
      correlationId,
      causationId: null,
      actor,
      aggregate: { type: 'user-profile', id: userProfile.id },
      payload: {
        userId: userProfile.id,
        email: userProfile.email.asString,
        firstName: userProfile.firstName,
        lastName: userProfile.lastName,
        role: 'client',
        locale: userProfile.locale,
        acquisitionSource: userProfile.acquisition.source,
        acquisitionMedium: userProfile.acquisition.medium ?? null,
        acquisitionCampaign: userProfile.acquisition.campaign ?? null,
        acquisitionContent: userProfile.acquisition.content ?? null,
        acquisitionTerm: userProfile.acquisition.term ?? null,
        acquisitionReferralId: userProfile.acquisition.referralId ?? null,
        marketingOptIn: userProfile.marketingOptIn,
        registeredAt: userProfile.createdAt.toISOString(),
      },
    };
  }

  private buildEmailSendEvent(args: {
    userProfile: UserProfile;
    verifyToken: string;
    tokenExpiresAt: Date;
    correlationId: string;
    occurredAt: Date;
  }): EmailSendV1 {
    const {
      userProfile,
      verifyToken,
      tokenExpiresAt,
      correlationId,
      occurredAt,
    } = args;
    // Review patch P1 — use the sentinel SYSTEM_ACTOR_USER_ID (nil UUID) so
    // downstream consumers iterating `actor.userId` see a parseable UUID
    // sentinel rather than the magic string 'system'.
    const systemActor: Actor = {
      userId: SYSTEM_ACTOR_USER_ID,
      role: 'system',
      locale: userProfile.locale,
    };
    // Review patch P15 — normalize publicBaseUrl trailing slash via the URL
    // constructor so `http://example.com/` and `http://example.com` both produce
    // the same canonical URL without `//` artifacts.
    const baseHref = this.publicBaseUrl.endsWith('/')
      ? this.publicBaseUrl
      : `${this.publicBaseUrl}/`;
    const verifyUrlObj = new URL(
      `${userProfile.locale}/auth/email/verify`,
      baseHref,
    );
    verifyUrlObj.searchParams.set('token', verifyToken);
    const verifyUrl = verifyUrlObj.toString();
    return {
      eventId: this.newUuid(),
      eventType: 'notification.email.send.v1',
      eventVersion: 'v1',
      occurredAt: occurredAt.toISOString(),
      correlationId,
      causationId: null,
      actor: systemActor,
      aggregate: { type: 'user-profile', id: userProfile.id },
      payload: {
        templateId: 'email-verify',
        locale: userProfile.locale,
        to: {
          email: userProfile.email.asString,
          userId: userProfile.id,
          name: `${userProfile.firstName} ${userProfile.lastName}`,
        },
        params: {
          firstName: userProfile.firstName,
          verifyUrl,
          expiresAt: tokenExpiresAt.toISOString(),
        },
      },
    };
  }
}

function isPgUniqueViolation(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code?: unknown }).code === PG_UNIQUE_VIOLATION_CODE
  );
}
