import { randomUUID } from 'node:crypto';
import type { AcquisitionSource } from '@tukio/contracts/types/Acquisition';
import {
  IdentityErrorCodes,
  type IdentityErrorCode,
} from '@tukio/contracts/types/error-codes';
import {
  SYSTEM_ACTOR_USER_ID,
  SYSTEM_ACTOR_ROLE,
  type Actor,
} from '@tukio/contracts/types/Actor';
import type { ProRegisteredV1 } from '@tukio/contracts/events/identity/pro-registered.v1';
import type { EmailSendV1 } from '@tukio/contracts/events/notification/email-send.v1';
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
  KeycloakUnreachableError,
} from '../domain/ports/keycloak-admin.port.js';
import {
  type IInseeSiretValidator,
  InseeSiretNotFoundError,
  InseeRateLimitError,
  InseeUnreachableError,
  InseeAuthFailedError,
} from '../domain/ports/insee-siret-validator.port.js';
import {
  type IMediaStorage,
  type MediaUploadInput,
  MediaStorageUploadError,
} from '../domain/ports/media-storage.port.js';
import { IdentityConflictException } from '../domain/exception/identity-conflict.exception.js';
import { IdentityValidationException } from '../domain/exception/identity-validation.exception.js';
import { ExternalServiceException } from '../domain/exception/external-service.exception.js';
import { EmailNotVerifiedException } from '../domain/exception/email-not-verified.exception.js';
import { AlreadyProException } from '../domain/exception/already-pro.exception.js';

const PG_UNIQUE_VIOLATION_CODE = '23505';

/**
 * One uploaded KYC document — shared with `RegisterProUseCase` (Story 1.3b).
 * Re-exported here so `parse-multipart-pro-register.ts` can import from one place.
 */
export interface ConvertCustomerToProFile {
  buffer: Buffer;
  contentType: string;
  /** Original filename, used only to derive the R2 object key extension. */
  originalName: string;
}

export interface ConvertCustomerToProInput {
  /** Keycloak user id (`sub` claim from JWT forwarded by gateway-api). */
  userId: string;
  // Identity (step 1 — pre-filled from Customer account, editable in the wizard)
  dateOfBirth: string;
  contactPhone: string;
  acceptMarketing: boolean;
  // Activity (step 2)
  companyName: string;
  siret: string;
  vatNumber?: string;
  legalForm: string;
  vatStatus: string;
  categories: string[];
  serviceZone: { city: string; radiusKm: number };
  address: {
    street: string;
    postalCode: string;
    city: string;
    country: 'FR';
  };
  // Documents (step 3 — KYC files already buffered by the multipart parser upstream)
  files: {
    idCard: ConvertCustomerToProFile;
    rib: ConvertCustomerToProFile;
    kbisOrInsee?: ConvertCustomerToProFile;
  };
  // Summary (step 4 — charter acceptance)
  acceptCharter: true;
  // Cross-cutting
  acquisition?: {
    source?: AcquisitionSource;
    medium?: string;
    campaign?: string;
    content?: string;
    term?: string;
    referralId?: string;
  };
  correlationId?: string;
}

export interface ConvertCustomerToProResult {
  userId: string;
  proProfileId: string;
  requiresAdminReview: true;
  requiresEmailVerification: false;
}

interface UploadedKycKeys {
  idCardR2Key: string;
  ribR2Key: string;
  kbisR2Key: string | null;
}

/**
 * Pattern Pretre — pure use case, NO NestJS decorators.
 * Wiring happens in `infrastructure/usecases-proxy/usecases-proxy.module.ts`
 * (Story 1.3b-bis: `CONVERT_CUSTOMER_TO_PRO_USECASES_PROXY`).
 *
 * Converts an authenticated Customer account to a Pro (pending admin review).
 * Unlike `RegisterProUseCase` (Story 1.3b), no new Keycloak user is created —
 * the existing account receives an additional realm role and a `tukio:status`
 * attribute. The CustomerProfile UserProfile row is updated accordingly.
 *
 * Flow:
 *   1. Verify the Keycloak user exists and has `emailVerified=true`.
 *   2. Confirm the user does NOT already hold the `pro` realm role.
 *   3. Validate SIRET against INSEE SIRENE V3.11.
 *   4. Check SIRET uniqueness in the local DB.
 *   5. Upload KYC files to R2 (SSE-S3).
 *   6. Atomic DB transaction: update UserProfile role+status + save ProProfile +
 *      publish outbox event.
 *   7. Assign Keycloak realm role `pro` + set attribute `tukio:status=pending_admin_review`.
 *   8. Return { userId, proProfileId, requiresAdminReview: true, requiresEmailVerification: false }.
 */
export class ConvertCustomerToProUseCase {
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
    input: ConvertCustomerToProInput,
  ): Promise<ConvertCustomerToProResult> {
    const now = this.now();
    const correlationId = input.correlationId ?? this.newUuid();

    // 1. Find the Keycloak user and verify email is confirmed.
    const kcUser = await this.findAndVerifyUser(input.userId, correlationId);

    // 2. Guard against re-conversion (idempotency guard at Keycloak level).
    const isAlreadyPro = await this.checkNotAlreadyPro(
      input.userId,
      correlationId,
    );
    if (isAlreadyPro) {
      throw new AlreadyProException();
    }

    // 3. INSEE validation — must be active.
    const siretVo = Siret.create(input.siret);
    const vatNumberVo = input.vatNumber
      ? VatNumber.create(input.vatNumber)
      : null;
    const addressVo = Address.create(input.address);
    const phoneVo = PhoneNumber.create(input.contactPhone);

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
      if (err instanceof InseeAuthFailedError) {
        this.logger.error(
          'INSEE SIRENE API authentication failed — apiKey misconfigured or revoked',
          { status: err.status, correlationId },
        );
        throw this.external(
          IdentityErrorCodes.EXTERNAL_INSEE_AUTH_FAILED,
          'INSEE service authentication failed',
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

    // 4. SIRET uniqueness check in local DB.
    const existingPro = await this.proProfileRepo.findBySiret(siretVo);
    if (existingPro !== null) {
      throw this.conflict(
        IdentityErrorCodes.CONFLICT_SIRET_EXISTS,
        'SIRET already registered to an active Pro account',
      );
    }

    // 5. Find the existing UserProfile by keycloakUserId.
    const userProfile = await this.userProfileRepo.findByKeycloakUserId(
      input.userId,
    );
    if (userProfile === null) {
      throw this.validation(
        IdentityErrorCodes.NOT_FOUND_USER,
        'UserProfile not found for this Keycloak user — account inconsistency',
      );
    }
    // Guard: soft-deleted accounts cannot be converted.
    if (userProfile.isDeleted()) {
      throw this.validation(
        IdentityErrorCodes.VALIDATION_INPUT_INVALID,
        'Account is deleted and cannot be converted to a Pro account',
      );
    }
    // Guard (D2 decision): only active Customer accounts may be converted.
    if (userProfile.role !== UserRole.CLIENT) {
      throw this.validation(
        IdentityErrorCodes.VALIDATION_INPUT_INVALID,
        'Only Customer accounts (role=client) may be converted to Pro',
      );
    }
    if (userProfile.status !== UserStatus.ACTIVE) {
      throw this.validation(
        IdentityErrorCodes.VALIDATION_INPUT_INVALID,
        'Only active accounts (status=active) may be converted to Pro',
      );
    }

    // 6. Upload KYC files to R2 using the existing userProfile.id as prefix.
    const proProfileId = this.newUuid();
    const uploadedKeys: UploadedKycKeys = {
      idCardR2Key: '',
      ribR2Key: '',
      kbisR2Key: null,
    };
    const uploadDescriptors: Array<{
      docType: 'id-card' | 'rib' | 'kbis-or-insee';
      file: ConvertCustomerToProFile;
      assignKey: (key: string) => void;
    }> = [
      {
        docType: 'id-card',
        file: input.files.idCard,
        assignKey: (key) => {
          uploadedKeys.idCardR2Key = key;
        },
      },
      {
        docType: 'rib',
        file: input.files.rib,
        assignKey: (key) => {
          uploadedKeys.ribR2Key = key;
        },
      },
    ];
    if (input.files.kbisOrInsee) {
      uploadDescriptors.push({
        docType: 'kbis-or-insee',
        file: input.files.kbisOrInsee,
        assignKey: (key) => {
          uploadedKeys.kbisR2Key = key;
        },
      });
    }
    const uploadResults = await Promise.allSettled(
      uploadDescriptors.map(async (d) => {
        const key = await this.uploadKyc(
          userProfile.id,
          d.docType,
          d.file,
          correlationId,
        );
        d.assignKey(key);
        return key;
      }),
    );
    const firstFailure = uploadResults.find(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );
    if (firstFailure) {
      await this.compensateR2(uploadedKeys, correlationId);
      const err: unknown = firstFailure.reason;
      if (err instanceof MediaStorageUploadError) {
        throw this.external(
          IdentityErrorCodes.EXTERNAL_R2_UPLOAD_FAILED,
          'KYC media storage upload failed',
        );
      }
      throw err;
    }

    // 7. Atomic DB transaction: update UserProfile role+status, save ProProfile, publish events.
    try {
      const updatedUserProfile = userProfile.convertToPro(now);

      const proProfile = ProProfile.register({
        id: proProfileId,
        userProfileId: userProfile.id,
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
        inseeAdministrativeStatus: 'active',
        insee: {
          legalName: inseeSnapshot.legalName,
          incorporationDate: inseeSnapshot.incorporationDate,
          legalCategory: inseeSnapshot.legalCategory,
          naf: inseeSnapshot.naf,
        },
        conversion: {
          dateOfBirth: input.dateOfBirth,
          legalForm: input.legalForm,
          vatStatus: input.vatStatus,
          categories: input.categories,
          serviceZone: input.serviceZone,
        },
        now,
      });

      await this.proProfileRepo.runInTransaction(async (txn) => {
        await txn.userProfileRepo.save(updatedUserProfile);
        await txn.proProfileRepo.save(proProfile);

        const proRegisteredEvent = this.buildProRegisteredEvent({
          userProfile: updatedUserProfile,
          proProfile,
          kcEmail: kcUser.email,
          kcFirstName: kcUser.firstName,
          kcLastName: kcUser.lastName,
          correlationId,
          occurredAt: now,
        });
        await txn.eventPublisher.publish(proRegisteredEvent);

        const emailSendEvent = this.buildEmailSendEvent({
          userProfile: updatedUserProfile,
          proProfile,
          kcEmail: kcUser.email,
          kcFirstName: kcUser.firstName,
          correlationId,
          occurredAt: now,
        });
        await txn.eventPublisher.publish(emailSendEvent);
      });
    } catch (err) {
      if (isPgUniqueViolation(err)) {
        await this.compensateR2(uploadedKeys, correlationId);
        throw this.conflict(
          IdentityErrorCodes.CONFLICT_SIRET_EXISTS,
          'SIRET already registered to an active Pro account (concurrent registration)',
        );
      }
      await this.compensateR2(uploadedKeys, correlationId);
      throw err;
    }

    // 8. Assign Keycloak realm role + set status attribute (best-effort after DB commit).
    await this.assignKeycloakProRole(
      input.userId,
      kcUser.existingAttributes,
      correlationId,
    );

    return {
      userId: userProfile.id,
      proProfileId,
      requiresAdminReview: true,
      requiresEmailVerification: false,
    };
  }

  private async findAndVerifyUser(
    keycloakUserId: string,
    correlationId: string,
  ): Promise<{
    email: string;
    firstName: string;
    lastName: string;
    existingAttributes: Record<string, string[]>;
  }> {
    let kcUser;
    try {
      kcUser = await this.keycloakAdmin.findUserById(keycloakUserId);
    } catch (err) {
      if (err instanceof KeycloakUnreachableError) {
        throw this.external(
          IdentityErrorCodes.EXTERNAL_KEYCLOAK_DOWN,
          'Keycloak unreachable while looking up user',
        );
      }
      throw err;
    }
    if (kcUser === null) {
      this.logger.warn(
        'ConvertCustomerToProUseCase: Keycloak user not found — JWT sub mismatch',
        { keycloakUserId: '[REDACTED]', correlationId },
      );
      throw this.external(
        IdentityErrorCodes.EXTERNAL_KEYCLOAK_DOWN,
        'Keycloak user not found',
      );
    }
    if (!kcUser.emailVerified) {
      throw new EmailNotVerifiedException();
    }
    return {
      email: kcUser.email,
      firstName: kcUser.firstName,
      lastName: kcUser.lastName,
      existingAttributes: kcUser.attributes,
    };
  }

  private async checkNotAlreadyPro(
    keycloakUserId: string,
    correlationId: string,
  ): Promise<boolean> {
    try {
      return await this.keycloakAdmin.hasRealmRole(
        keycloakUserId,
        UserRole.PRO,
      );
    } catch (err) {
      if (err instanceof KeycloakUnreachableError) {
        throw this.external(
          IdentityErrorCodes.EXTERNAL_KEYCLOAK_DOWN,
          'Keycloak unreachable while checking roles',
        );
      }
      void correlationId;
      throw err;
    }
  }

  private async assignKeycloakProRole(
    keycloakUserId: string,
    existingAttributes: Record<string, string[]>,
    correlationId: string,
  ): Promise<void> {
    try {
      await this.keycloakAdmin.assignRealmRole(keycloakUserId, UserRole.PRO);
      // Merge the new status into existing attributes so we do NOT silently
      // wipe other custom attributes (e.g. tukio:locale) that were set at
      // customer registration. Keycloak's users.update replaces the full map.
      await this.keycloakAdmin.setUserAttributes(keycloakUserId, {
        ...existingAttributes,
        'tukio:status': [UserStatus.PENDING_ADMIN_REVIEW],
      });
    } catch (err) {
      // Best-effort: if Keycloak role assignment fails after DB commit, log a
      // warning. The Story 1.10 reconciliation cron will detect and fix the drift.
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        'ConvertCustomerToProUseCase: Keycloak role/status update failed after DB commit — drift detected',
        {
          keycloakUserId: '[REDACTED]',
          correlationId,
          compensationError: message,
          drift: 'R8-conversion',
          followUp: 'Story 1.10 daily reconciliation cron',
        },
      );
    }
  }

  private async uploadKyc(
    userProfileId: string,
    documentType: 'id-card' | 'rib' | 'kbis-or-insee',
    file: ConvertCustomerToProFile,
    correlationId: string,
  ): Promise<string> {
    const ext = inferExtension(file.originalName, file.contentType);
    const key = `pro/${userProfileId}/${documentType}${ext}`;
    const uploadInput: MediaUploadInput = {
      bucket: this.kycBucket,
      key,
      body: file.buffer,
      contentType: file.contentType,
      metadata: { actorId: userProfileId, documentType, correlationId },
    };
    const result = await this.mediaStorage.upload(uploadInput);
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
    kcEmail: string;
    kcFirstName: string;
    kcLastName: string;
    correlationId: string;
    occurredAt: Date;
  }): ProRegisteredV1 {
    const {
      userProfile,
      proProfile,
      kcEmail,
      kcFirstName,
      kcLastName,
      correlationId,
      occurredAt,
    } = args;
    const actor = {
      userId: userProfile.id,
      role: UserRole.PRO,
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
        email: kcEmail,
        firstName: kcFirstName,
        lastName: kcLastName,
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
        inseeNaf: proProfile.insee.naf,
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
    kcEmail: string;
    kcFirstName: string;
    correlationId: string;
    occurredAt: Date;
  }): EmailSendV1 {
    const {
      userProfile,
      proProfile,
      kcEmail,
      kcFirstName,
      correlationId,
      occurredAt,
    } = args;
    const systemActor: Actor = {
      userId: SYSTEM_ACTOR_USER_ID,
      role: SYSTEM_ACTOR_ROLE,
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
          email: kcEmail,
          userId: userProfile.id,
          name: kcFirstName,
        },
        params: {
          firstName: kcFirstName,
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
  const idx = filename.lastIndexOf('.');
  if (idx >= 0 && idx < filename.length - 1) {
    const ext = filename.slice(idx).toLowerCase();
    if (ALLOWED_EXTENSIONS.has(ext)) return ext;
  }
  return '';
}
