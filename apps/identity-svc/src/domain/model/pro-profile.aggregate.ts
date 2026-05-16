import { randomUUID } from 'node:crypto';
import { Address, type AddressProps } from './address.value-object.js';
import { PhoneNumber } from './phone-number.value-object.js';
import { Siret } from './siret.value-object.js';
import { VatNumber } from './vat-number.value-object.js';
import { KycStatus } from './kyc-status.enum.js';
import { InvalidProProfileException } from '../exception/invalid-pro-profile.exception.js';

const COMPANY_NAME_MIN = 1;
const COMPANY_NAME_MAX = 200;

/**
 * INSEE snapshot fields captured at registration time. Stored alongside the
 * aggregate so the admin queue (Story 2.3-2.4) can audit what INSEE returned
 * when the Pro signed up, even if the legal entity is later modified or ceased.
 */
export interface ProInseeSnapshot {
  denomination: string | null;
  dateCreation: string | null;
  categorieJuridique: string | null;
}

/**
 * R2 keys for the three KYC documents uploaded at registration. The bucket
 * itself is environment-scoped (`tukio-kyc-{env}`) and held in config, not
 * here — the aggregate only stores the per-object key (e.g.
 * `pro/<userProfileId>/id-card.jpg`).
 */
export interface ProKycRefs {
  idCardR2Key: string;
  ribR2Key: string;
  kbisR2Key: string | null;
}

export interface ProProfileProps {
  id: string;
  userProfileId: string;
  companyName: string;
  siret: Siret;
  vatNumber: VatNumber | null;
  address: Address;
  contactPhone: PhoneNumber;
  kycStatus: KycStatus;
  kyc: ProKycRefs;
  insee: ProInseeSnapshot;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface RegisterProProps {
  userProfileId: string;
  companyName: string;
  siret: Siret;
  vatNumber?: VatNumber;
  address: Address;
  contactPhone: PhoneNumber;
  kyc: ProKycRefs;
  insee: ProInseeSnapshot;
  /** Override for tests; defaults to `randomUUID()` at call time. */
  id?: string;
  /** Override for tests; defaults to `new Date()` at call time. */
  now?: Date;
}

export class ProProfile {
  readonly id: string;
  readonly userProfileId: string;
  readonly companyName: string;
  readonly siret: Siret;
  readonly vatNumber: VatNumber | null;
  readonly address: Address;
  readonly contactPhone: PhoneNumber;
  readonly kycStatus: KycStatus;
  readonly kyc: ProKycRefs;
  readonly insee: ProInseeSnapshot;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;

  private constructor(props: ProProfileProps) {
    this.id = props.id;
    this.userProfileId = props.userProfileId;
    this.companyName = props.companyName;
    this.siret = props.siret;
    this.vatNumber = props.vatNumber;
    this.address = props.address;
    this.contactPhone = props.contactPhone;
    this.kycStatus = props.kycStatus;
    this.kyc = props.kyc;
    this.insee = props.insee;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.deletedAt = props.deletedAt;
  }

  static create(props: ProProfileProps): ProProfile {
    ProProfile.assertNonEmptyId(props.id, 'id');
    ProProfile.assertNonEmptyId(props.userProfileId, 'userProfileId');
    ProProfile.assertCompanyName(props.companyName);
    if (!Object.values(KycStatus).includes(props.kycStatus)) {
      throw new InvalidProProfileException(
        `Invalid kycStatus: ${String(props.kycStatus)}`,
      );
    }
    ProProfile.assertKycRefs(props.kyc);

    return new ProProfile({
      ...props,
      companyName: props.companyName.trim(),
    });
  }

  /**
   * Pro-specific factory used by `RegisterProUseCase` (Story 1.3a). Always
   * produces:
   *   - kycStatus = `pending_review` (admin verification queue, Story 2.x)
   *
   * The caller is responsible for having already :
   *   1. Validated the SIRET against INSEE and confirmed `etatAdministratif='A'`.
   *   2. Uploaded the three (or two when `kbisOrInsee` is omitted) KYC files
   *      to R2 and computed their keys.
   *   3. Persisted the matching `UserProfile` row with
   *      `status=pending_admin_review` so the FK reference resolves.
   */
  static register(props: RegisterProProps): ProProfile {
    const now = props.now ?? new Date();
    const id = props.id ?? randomUUID();

    return ProProfile.create({
      id,
      userProfileId: props.userProfileId,
      companyName: props.companyName,
      siret: props.siret,
      vatNumber: props.vatNumber ?? null,
      address: props.address,
      contactPhone: props.contactPhone,
      kycStatus: KycStatus.PENDING_REVIEW,
      kyc: {
        idCardR2Key: props.kyc.idCardR2Key,
        ribR2Key: props.kyc.ribR2Key,
        kbisR2Key: props.kyc.kbisR2Key,
      },
      insee: {
        denomination: props.insee.denomination,
        dateCreation: props.insee.dateCreation,
        categorieJuridique: props.insee.categorieJuridique,
      },
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  isPendingReview(): boolean {
    return this.kycStatus === KycStatus.PENDING_REVIEW;
  }

  isApproved(): boolean {
    return this.kycStatus === KycStatus.APPROVED;
  }

  isRejected(): boolean {
    return this.kycStatus === KycStatus.REJECTED;
  }

  isDeleted(): boolean {
    return this.deletedAt !== null;
  }

  private static assertNonEmptyId(value: string, field: string): void {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new InvalidProProfileException(
        `Field ${field} must be a non-empty string`,
      );
    }
  }

  private static assertCompanyName(value: string): void {
    if (typeof value !== 'string') {
      throw new InvalidProProfileException('companyName must be a string');
    }
    const trimmedLength = value.trim().length;
    if (trimmedLength < COMPANY_NAME_MIN || trimmedLength > COMPANY_NAME_MAX) {
      throw new InvalidProProfileException(
        `companyName must be ${COMPANY_NAME_MIN}..${COMPANY_NAME_MAX} characters`,
      );
    }
  }

  private static assertKycRefs(kyc: ProKycRefs): void {
    if (typeof kyc.idCardR2Key !== 'string' || kyc.idCardR2Key.length === 0) {
      throw new InvalidProProfileException(
        'kyc.idCardR2Key must be a non-empty string',
      );
    }
    if (typeof kyc.ribR2Key !== 'string' || kyc.ribR2Key.length === 0) {
      throw new InvalidProProfileException(
        'kyc.ribR2Key must be a non-empty string',
      );
    }
    if (
      kyc.kbisR2Key !== null &&
      (typeof kyc.kbisR2Key !== 'string' || kyc.kbisR2Key.length === 0)
    ) {
      throw new InvalidProProfileException(
        'kyc.kbisR2Key must be a non-empty string or null',
      );
    }
  }
}

// Re-export the AddressProps shape so use cases can build an `Address` from
// upstream INSEE snapshots without importing the VO module separately.
export type { AddressProps };
