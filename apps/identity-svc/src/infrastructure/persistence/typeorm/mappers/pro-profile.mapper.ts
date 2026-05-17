import { Address } from '../../../../domain/model/address.value-object.js';
import { PhoneNumber } from '../../../../domain/model/phone-number.value-object.js';
import { ProProfile } from '../../../../domain/model/pro-profile.aggregate.js';
import { Siret } from '../../../../domain/model/siret.value-object.js';
import { VatNumber } from '../../../../domain/model/vat-number.value-object.js';
import { isKycStatus } from '../../../../domain/model/kyc-status.enum.js';
import { CorruptedDataException } from '../../../../domain/exception/corrupted-data.exception.js';
import { ProProfileEntity } from '../entities/pro-profile.entity.js';

interface AddressJsonbShape {
  street: string;
  postalCode: string;
  city: string;
  country: string;
}

function assertAddressJsonb(
  value: unknown,
): asserts value is AddressJsonbShape {
  if (value === null || typeof value !== 'object') {
    throw new CorruptedDataException(
      'pro_profiles.address JSONB is not an object',
    );
  }
  const obj = value as Record<string, unknown>;
  for (const key of ['street', 'postalCode', 'city', 'country'] as const) {
    if (typeof obj[key] !== 'string') {
      throw new CorruptedDataException(
        `pro_profiles.address.${key} is missing or not a string`,
      );
    }
  }
  if (obj['country'] !== 'FR') {
    throw new CorruptedDataException(
      `pro_profiles.address.country must be 'FR' (got: ${String(obj['country'])})`,
    );
  }
}

export class ProProfileMapper {
  static toDomain(entity: ProProfileEntity): ProProfile {
    if (!isKycStatus(entity.kycStatus)) {
      throw new CorruptedDataException(
        `invalid kyc_status value in pro_profiles row: ${entity.kycStatus}`,
      );
    }
    // P11 — validate the JSONB shape before constructing the VO instead of
    // unsafe `as 'FR'` cast. A corrupted row (manual edit, partial migration)
    // surfaces as a clear `CorruptedDataException` rather than a downstream
    // VO error or silent invalid state.
    assertAddressJsonb(entity.address);
    return ProProfile.create({
      id: entity.id,
      userProfileId: entity.userProfileId,
      companyName: entity.companyName,
      siret: Siret.create(entity.siret),
      vatNumber: entity.vatNumber ? VatNumber.create(entity.vatNumber) : null,
      address: Address.create({
        street: entity.address.street,
        postalCode: entity.address.postalCode,
        city: entity.address.city,
        country: 'FR',
      }),
      contactPhone: PhoneNumber.create(entity.contactPhone),
      kycStatus: entity.kycStatus,
      kyc: {
        idCardR2Key: entity.kycIdCardR2Key,
        ribR2Key: entity.kycRibR2Key,
        kbisR2Key: entity.kycKbisR2Key,
      },
      insee: {
        legalName: entity.inseeDenomination,
        incorporationDate: entity.inseeIncorporationDate,
        legalCategory: entity.inseeLegalCategory,
        naf: entity.inseeNaf,
        checkedAt: entity.inseeCheckedAt,
      },
      kycDecision: {
        decidedAt: entity.kycDecisionAt,
        decidedBy: entity.kycDecisionBy,
        reason: entity.kycDecisionReason,
      },
      conversion: {
        dateOfBirth: entity.dateOfBirth,
        legalForm: entity.legalForm,
        vatStatus: entity.vatStatus,
        categories: Array.isArray(entity.categories) ? entity.categories : [],
        serviceZone: {
          city: entity.serviceZone.city ?? '',
          radiusKm: entity.serviceZone.radiusKm ?? 0,
        },
      },
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      deletedAt: entity.deletedAt,
    });
  }

  static toEntity(aggregate: ProProfile): ProProfileEntity {
    const entity = new ProProfileEntity();
    entity.id = aggregate.id;
    entity.userProfileId = aggregate.userProfileId;
    entity.companyName = aggregate.companyName;
    entity.siret = aggregate.siret.asString;
    entity.vatNumber = aggregate.vatNumber?.asString ?? null;
    entity.address = {
      street: aggregate.address.street,
      postalCode: aggregate.address.postalCode,
      city: aggregate.address.city,
      country: aggregate.address.country,
    };
    entity.contactPhone = aggregate.contactPhone.asString;
    entity.kycIdCardR2Key = aggregate.kyc.idCardR2Key;
    entity.kycRibR2Key = aggregate.kyc.ribR2Key;
    entity.kycKbisR2Key = aggregate.kyc.kbisR2Key;
    entity.kycStatus = aggregate.kycStatus;
    // D2 — kycDecision is now round-tripped via the aggregate instead of
    // being silently nulled on every save. Story 2.3-2.4 will use aggregate
    // methods to set these before saving.
    entity.kycDecisionAt = aggregate.kycDecision.decidedAt;
    entity.kycDecisionBy = aggregate.kycDecision.decidedBy;
    entity.kycDecisionReason = aggregate.kycDecision.reason;
    entity.inseeDenomination = aggregate.insee.legalName;
    entity.inseeIncorporationDate = aggregate.insee.incorporationDate;
    entity.inseeLegalCategory = aggregate.insee.legalCategory;
    entity.inseeNaf = aggregate.insee.naf;
    // P13 — `inseeCheckedAt` is the aggregate's authoritative value, NOT
    // `new Date()` on every save (which would silently turn "when INSEE was
    // last consulted" into "when the row was last persisted").
    entity.inseeCheckedAt = aggregate.insee.checkedAt;
    entity.dateOfBirth = aggregate.conversion.dateOfBirth;
    entity.legalForm = aggregate.conversion.legalForm;
    entity.vatStatus = aggregate.conversion.vatStatus;
    entity.categories = [...aggregate.conversion.categories];
    entity.serviceZone = {
      city: aggregate.conversion.serviceZone.city,
      radiusKm: aggregate.conversion.serviceZone.radiusKm,
    };
    entity.deletedAt = aggregate.deletedAt;
    // P12 — createdAt / updatedAt are intentionally NOT set here. The entity
    // uses @CreateDateColumn / @UpdateDateColumn, so PostgreSQL sets the
    // creation timestamp at INSERT and TypeORM bumps `updated_at` on every
    // save. Setting them from the aggregate would freeze them.
    return entity;
  }
}
