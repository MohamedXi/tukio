import { randomUUID } from 'node:crypto';
import type { Locale } from '@tukio/contracts/types/Locale';
import type { AcquisitionSource } from '@tukio/contracts/types/Acquisition';
import {
  IdentityErrorCodes,
  type IdentityErrorCode,
} from '@tukio/contracts/types/error-codes';
import { SYSTEM_ACTOR_USER_ID, type Actor } from '@tukio/contracts/types/Actor';
import type { ProRegisteredV1 } from '@tukio/contracts/events/identity/pro-registered.v1';
import type { EmailSendV1 } from '@tukio/contracts/events/notification/email-send.v1';
import { Email } from '../domain/model/email.value-object.js';
import { Siret } from '../domain/model/siret.value-object.js';
import { VatNumber } from '../domain/model/vat-number.value-object.js';
import { Address } from '../domain/model/address.value-object.js';
import { PhoneNumber } from '../domain/model/phone-number.value-object.js';
import { UserProfile } from '../domain/model/user-profile.aggregate.js';
import { ProProfile } from '../domain/model/pro-profile.aggregate.js';
import { KycStatus } from '../domain/model/kyc-status.enum.js';
import { UserRole } from '../domain/model/user-role.enum.js';
import { UserStatus } from '../domain/model/user-status.enum.js';
import type { IUserProfileRepository } from '../domain/ports/user-profile.repository.port.js';
import type { IProProfileRepository } from '../domain/ports/pro-profile.repository.port.js';
import type { ILogger } from '../domain/ports/logger.port.js';
import {
  type IKeycloakAdmin,
  KeycloakUserAlreadyExistsError,
  KeycloakUnreachableError,
} from '../domain/ports/keycloak-admin.port.js';
import {
  type IInseeSiretValidator,
  InseeSiretNotFoundError,
  InseeRateLimitError,
  InseeUnreachableError,
} from '../domain/ports/insee-siret-validator.port.js';
import {
  type IMediaStorage,
  type MediaUploadInput,
  MediaStorageUploadError,
} from '../domain/ports/media-storage.port.js';
import { IdentityConflictException } from '../domain/exception/identity-conflict.exception.js';
import { IdentityValidationException } from '../domain/exception/identity-validation.exception.js';
import { ExternalServiceException } from '../domain/exception/external-service.exception.js';

const PG_UNIQUE_VIOLATION_CODE = '23505';
const COMPENSATION_TIMEOUT_MS = 5_000;
// Constraint names set in Story 1.2b (user_profiles.email) and Story 1.3b
// (pro_profiles.siret) migrations. Used to disambiguate 23505 violations.
const PG_EMAIL_UNIQUE_CONSTRAINT = 'uq_user_profiles_email';

/**
 * One uploaded KYC document. The use case is agnostic to the multer / fastify
 * wrapper that produced the buffer — the controller layer (Story 1.3b) is
 * responsible for adapting `Express.Multer.File` to this shape.
 */
export interface RegisterProFile {
  buffer: Buffer;
  contentType: string;
  /** Original filename, used only to derive the R2 object key extension. */
  originalName: string;
}

export interface RegisterProUseCaseInput {
  // Step 1 — Account
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  locale: Locale;
  acceptTerms: true;
  acceptMarketing: boolean;
  // Step 2 — Company
  companyName: string;
  siret: string;
  vatNumber?: string;
  address: {
    street: string;
    postalCode: string;
    city: string;
    country: 'FR';
  };
  contactPhone: string;
  // Cross-cutting
  acquisition?: {
    source?: AcquisitionSource;
    medium?: string;
    campaign?: string;
    content?: string;
    term?: string;
    referralId?: string;
  };
  // Step 3 — KYC files (already buffered by the multer parser upstream)
  files: {
    idCard: RegisterProFile;
    rib: RegisterProFile;
    kbisOrInsee?: RegisterProFile;
  };
  correlationId?: string;
}

export interface RegisterProUseCaseResult {
  userId: string;
  proProfileId: string;
  requiresAdminReview: true;
  requiresEmailVerification: true;
}

interface UploadedKycKeys {
  idCardR2Key: string;
  ribR2Key: string;
  kbisR2Key: string | null;
}

/**
 * Pattern Pretre — pure use case, NO NestJS decorators.
 * Wiring happens in `infrastructure/usecases-proxy/usecases-proxy.module.ts`
 * (Story 1.3b: `REGISTER_PRO_USECASES_PROXY`).
 *
 * Orchestrates the compensable saga that registers a pro:
 *   1. Pre-check SIRET uniqueness in the local DB (FR16 anti-doublon).
 *   2. Validate SIRET against INSEE SIRENE V3.11 (must be `etatAdministratif='A'`).
 *   3. Pre-check email uniqueness in the local DB (anti-enumeration NFR9).
 *   4. Create Keycloak user with role `pro` + claim `tukio:status='pending_admin_review'`.
 *   5. Upload the three (or two) KYC files to R2 with server-side encryption.
 *   6. Atomically persist UserProfile + ProProfile + outbox events
 *      (identity.pro.registered.v1 + notification.email.send.v1).
 *   7. On any failure after step 4, compensate: delete Keycloak user + delete
 *      already-uploaded R2 objects.
 */
export class RegisterProUseCase {
  constructor(
    private readonly userProfileRepo: IUserProfileRepository,
    private readonly proProfileRepo: IProProfileRepository,
    private readonly keycloakAdmin: IKeycloakAdmin,
    private readonly inseeValidator: IInseeSiretValidator,
    private readonly mediaStorage: IMediaStorage,
    private readonly logger: ILogger,
    private readonly kycBucket: string,
    private readonly now: () => Date = () => new Date(),
    private readonly newUuid: () => string = () => randomUUID(),
  ) {}

  async execute(
    input: RegisterProUseCaseInput,
  ): Promise<RegisterProUseCaseResult> {
    const now = this.now();
    const correlationId = input.correlationId ?? this.newUuid();

    // VOs throw IdentityValidationException synchronously on malformed input.
    // Upstream gateway-api ZodValidationPipe should catch most issues, but
    // defense-in-depth here protects against direct internal calls.
    const emailVo = Email.create(input.email);
    const siretVo = Siret.create(input.siret);
    const vatNumberVo = input.vatNumber
      ? VatNumber.create(input.vatNumber)
      : null;
    const addressVo = Address.create(input.address);
    const phoneVo = PhoneNumber.create(input.contactPhone);

    // 1. Pre-check SIRET pas déjà actif (FR16). Soft-deleted rows excluded
    //    by the repository implementation.
    const existingPro = await this.proProfileRepo.findBySiret(siretVo);
    if (existingPro !== null) {
      throw this.conflict(
        IdentityErrorCodes.CONFLICT_SIRET_EXISTS,
        'SIRET already registered to an active Pro account',
      );
    }

    // 2. INSEE validation — must be active. 404 / 'C' both map to the same
    //    "inactive SIRET" validation error from the user's perspective.
    let inseeSnapshot;
    try {
      inseeSnapshot = await this.inseeValidator.validate(siretVo);
    } catch (err) {
      if (err instanceof InseeSiretNotFoundError) {
        throw this.validation(
          IdentityErrorCodes.VALIDATION_SIRET_INACTIVE,
          'SIRET not found in the INSEE SIRENE register',
        );
      }
      if (err instanceof InseeRateLimitError) {
        throw this.external(
          IdentityErrorCodes.EXTERNAL_INSEE_UNREACHABLE,
          `INSEE rate limit reached, retry after ${err.retryAfterMs} ms`,
        );
      }
      if (err instanceof InseeUnreachableError) {
        throw this.external(
          IdentityErrorCodes.EXTERNAL_INSEE_UNREACHABLE,
          'INSEE service unreachable',
        );
      }
      throw err;
    }
    if (inseeSnapshot.administrativeStatus !== 'active') {
      throw this.validation(
        IdentityErrorCodes.VALIDATION_SIRET_INACTIVE,
        'SIRET is not administratively active at INSEE',
      );
    }

    // 3. Pre-check email pas déjà utilisé.
    const existingUser = await this.userProfileRepo.findByEmail(
      emailVo.asString,
    );
    if (existingUser !== null) {
      throw this.conflict(
        IdentityErrorCodes.CONFLICT_EMAIL_EXISTS,
        'Email already registered',
      );
    }

    // 4. Keycloak createUser (role=pro, status=pending_admin_review).
    let keycloakUserId: string;
    try {
      const result = await this.keycloakAdmin.createUser({
        email: emailVo.asString,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        password: input.password,
        locale: input.locale,
        emailVerified: false,
        role: UserRole.PRO,
        status: UserStatus.PENDING_ADMIN_REVIEW,
      });
      keycloakUserId = result.keycloakUserId;
    } catch (err) {
      if (err instanceof KeycloakUserAlreadyExistsError) {
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

    // 5. Upload KYC documents to R2 in parallel. The user profile id is
    //    generated up-front so we can prefix R2 keys with it (stable forensic
    //    trail even if the DB rolls back later — orphan blobs are GC-ed by the
    //    Story 1.10 reconciliation job).
    const userProfileId = this.newUuid();
    const proProfileId = this.newUuid();
    // Track keys as each upload completes so partial failures can be compensated.
    const uploadedKeys: UploadedKycKeys = {
      idCardR2Key: '',
      ribR2Key: '',
      kbisR2Key: null,
    };
    try {
      await Promise.all([
        this.uploadKyc(
          userProfileId,
          'id-card',
          input.files.idCard,
          correlationId,
        ).then((key) => {
          uploadedKeys.idCardR2Key = key;
        }),
        this.uploadKyc(
          userProfileId,
          'rib',
          input.files.rib,
          correlationId,
        ).then((key) => {
          uploadedKeys.ribR2Key = key;
        }),
        input.files.kbisOrInsee
          ? this.uploadKyc(
              userProfileId,
              'kbis-or-insee',
              input.files.kbisOrInsee,
              correlationId,
            ).then((key) => {
              uploadedKeys.kbisR2Key = key;
            })
          : Promise.resolve(),
      ]);
    } catch (err) {
      // Compensate Keycloak before bubbling the R2 error to the caller; any
      // partial uploads that completed before the failure are deleted in
      // `compensateR2` below.
      await this.compensateR2(uploadedKeys, correlationId);
      await this.compensateKeycloak(keycloakUserId, correlationId);
      if (err instanceof MediaStorageUploadError) {
        throw this.external(
          IdentityErrorCodes.EXTERNAL_R2_UPLOAD_FAILED,
          'KYC media storage upload failed',
        );
      }
      throw err;
    }

    // 6. Build aggregates + atomic save with outbox.
    try {
      const userProfile = UserProfile.register({
        id: userProfileId,
        keycloakUserId,
        email: emailVo,
        firstName: input.firstName,
        lastName: input.lastName,
        locale: input.locale,
        marketingOptIn: input.acceptMarketing,
        ...(input.acquisition && { acquisition: input.acquisition }),
        now,
      });

      // TODO(Story 1.2b): Add UserProfile.registerPro() factory to avoid this
      // two-step pattern. Until then, register() produces role=CLIENT/status=ACTIVE
      // and we override via create() to produce the correct PRO/PENDING_ADMIN_REVIEW state.
      const userProfilePro = UserProfile.create({
        ...userProfile,
        role: UserRole.PRO,
        status: UserStatus.PENDING_ADMIN_REVIEW,
      });

      const proProfile = ProProfile.register({
        id: proProfileId,
        userProfileId,
        companyName: input.companyName,
        siret: siretVo,
        ...(vatNumberVo !== null && { vatNumber: vatNumberVo }),
        address: addressVo,
        contactPhone: phoneVo,
        kyc: {
          idCardR2Key: uploadedKeys.idCardR2Key,
          ribR2Key: uploadedKeys.ribR2Key,
          kbisR2Key: uploadedKeys.kbisR2Key,
        },
        inseeAdministrativeStatus: inseeSnapshot.administrativeStatus,
        insee: {
          legalName: inseeSnapshot.legalName,
          incorporationDate: inseeSnapshot.incorporationDate,
          legalCategory: inseeSnapshot.legalCategory,
        },
        now,
      });

      await this.proProfileRepo.runInTransaction(async (txn) => {
        await txn.userProfileRepo.save(userProfilePro);
        await txn.proProfileRepo.save(proProfile);

        const proRegisteredEvent = this.buildProRegisteredEvent({
          userProfile: userProfilePro,
          proProfile,
          correlationId,
          occurredAt: now,
        });
        await txn.eventPublisher.publish(proRegisteredEvent);

        const emailSendEvent = this.buildEmailSendEvent({
          userProfile: userProfilePro,
          proProfile,
          correlationId,
          occurredAt: now,
        });
        await txn.eventPublisher.publish(emailSendEvent);
      });

      return {
        userId: userProfileId,
        proProfileId,
        requiresAdminReview: true,
        requiresEmailVerification: true,
      };
    } catch (err) {
      if (isPgUniqueViolation(err)) {
        await this.compensateR2(uploadedKeys, correlationId);
        await this.compensateKeycloak(keycloakUserId, correlationId);
        const constraint = (err as { constraint?: string }).constraint ?? '';
        if (constraint === PG_EMAIL_UNIQUE_CONSTRAINT) {
          throw this.conflict(
            IdentityErrorCodes.CONFLICT_EMAIL_EXISTS,
            'Email already registered (concurrent registration)',
          );
        }
        throw this.conflict(
          IdentityErrorCodes.CONFLICT_SIRET_EXISTS,
          'SIRET already registered to an active Pro account',
        );
      }
      await this.compensateR2(uploadedKeys, correlationId);
      await this.compensateKeycloak(keycloakUserId, correlationId);
      throw err;
    }
  }

  private async uploadKyc(
    userProfileId: string,
    documentType: 'id-card' | 'rib' | 'kbis-or-insee',
    file: RegisterProFile,
    correlationId: string,
  ): Promise<string> {
    const ext = inferExtension(file.originalName, file.contentType);
    const key = `pro/${userProfileId}/${documentType}${ext}`;
    const input: MediaUploadInput = {
      bucket: this.kycBucket,
      key,
      body: file.buffer,
      contentType: file.contentType,
      metadata: { actorId: userProfileId, documentType, correlationId },
    };
    const result = await this.mediaStorage.upload(input);
    return result.key;
  }

  private async compensateR2(
    keys: UploadedKycKeys,
    correlationId: string,
  ): Promise<void> {
    const toDelete = [keys.idCardR2Key, keys.ribR2Key, keys.kbisR2Key].filter(
      (k): k is string => typeof k === 'string' && k.length > 0,
    );
    if (toDelete.length === 0) return;
    await Promise.all(
      toDelete.map((key) =>
        this.mediaStorage
          .delete({ bucket: this.kycBucket, key })
          .catch((err) => {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(
              'R2 compensation delete failed — orphan KYC object requires reconciliation',
              {
                bucket: this.kycBucket,
                key,
                correlationId,
                compensationError: message,
              },
            );
          }),
      ),
    );
  }

  private async compensateKeycloak(
    keycloakUserId: string,
    correlationId: string,
  ): Promise<void> {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.keycloakAdmin.deleteUser(keycloakUserId),
        new Promise<never>((_resolve, reject) => {
          timeoutHandle = setTimeout(
            () =>
              reject(
                new Error(
                  `Keycloak compensation deleteUser timed out after ${COMPENSATION_TIMEOUT_MS}ms`,
                ),
              ),
            COMPENSATION_TIMEOUT_MS,
          );
        }),
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
        },
      );
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  private conflict(
    code: IdentityErrorCode,
    message: string,
  ): IdentityConflictException {
    return new IdentityConflictException(code, message);
  }

  private validation(
    code: IdentityErrorCode,
    message: string,
  ): IdentityValidationException {
    return new IdentityValidationException(code, message);
  }

  private external(
    code: IdentityErrorCode,
    message: string,
  ): ExternalServiceException {
    return new ExternalServiceException(code, message);
  }

  private buildProRegisteredEvent(args: {
    userProfile: UserProfile;
    proProfile: ProProfile;
    correlationId: string;
    occurredAt: Date;
  }): ProRegisteredV1 {
    const { userProfile, proProfile, correlationId, occurredAt } = args;
    // The pro-registered event narrows `actor.role` to the literal 'pro' for
    // schema correctness, so we build the narrowed actor here directly rather
    // than going through the generic `Actor` union.
    const actor = {
      userId: userProfile.id,
      role: 'pro' as const,
      locale: userProfile.locale,
    };
    return {
      eventId: this.newUuid(),
      eventType: 'identity.pro.registered.v1',
      eventVersion: 'v1',
      occurredAt: occurredAt.toISOString(),
      correlationId,
      causationId: null,
      actor,
      aggregate: { type: 'pro-profile', id: proProfile.id },
      payload: {
        userProfileId: userProfile.id,
        proProfileId: proProfile.id,
        email: userProfile.email.asString,
        firstName: userProfile.firstName,
        lastName: userProfile.lastName,
        companyName: proProfile.companyName,
        siret: proProfile.siret.asString,
        vatNumber: proProfile.vatNumber?.asString ?? null,
        address: {
          street: proProfile.address.street,
          postalCode: proProfile.address.postalCode,
          city: proProfile.address.city,
          country: proProfile.address.country,
        },
        contactPhone: proProfile.contactPhone.asString,
        kycStatus: KycStatus.PENDING_REVIEW,
        tukioStatus: UserStatus.PENDING_ADMIN_REVIEW,
        inseeLegalName: proProfile.insee.legalName,
        inseeIncorporationDate: proProfile.insee.incorporationDate,
        inseeLegalCategory: proProfile.insee.legalCategory,
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
    proProfile: ProProfile;
    correlationId: string;
    occurredAt: Date;
  }): EmailSendV1 {
    const { userProfile, proProfile, correlationId, occurredAt } = args;
    const systemActor: Actor = {
      userId: SYSTEM_ACTOR_USER_ID,
      role: 'system',
      locale: userProfile.locale,
    };
    return {
      eventId: this.newUuid(),
      eventType: 'notification.email.send.v1',
      eventVersion: 'v1',
      occurredAt: occurredAt.toISOString(),
      correlationId,
      causationId: null,
      actor: systemActor,
      aggregate: { type: 'pro-profile', id: proProfile.id },
      payload: {
        templateId: 'pro-pending-admin-review',
        locale: userProfile.locale,
        to: {
          email: userProfile.email.asString,
          userId: userProfile.id,
          name: `${userProfile.firstName} ${userProfile.lastName}`,
        },
        params: {
          firstName: userProfile.firstName,
          companyName: proProfile.companyName,
          siret: proProfile.siret.asString,
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

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'application/pdf': '.pdf',
};

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.pdf']);

function inferExtension(filename: string, contentType: string): string {
  const fromMime = EXT_BY_MIME[contentType.toLowerCase()];
  if (fromMime) return fromMime;
  // Fallback: take the extension from the filename only if it's in the allowlist.
  // Reject unknown extensions (e.g. .exe, .php) to prevent R2 namespace pollution.
  const idx = filename.lastIndexOf('.');
  if (idx >= 0 && idx < filename.length - 1) {
    const ext = filename.slice(idx).toLowerCase();
    if (ALLOWED_EXTENSIONS.has(ext)) return ext;
  }
  return '';
}
