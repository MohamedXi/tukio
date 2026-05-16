import { Address } from '../../../../domain/model/address.value-object.js';
import { PhoneNumber } from '../../../../domain/model/phone-number.value-object.js';
import { ProProfile } from '../../../../domain/model/pro-profile.aggregate.js';
import { Siret } from '../../../../domain/model/siret.value-object.js';
import { VatNumber } from '../../../../domain/model/vat-number.value-object.js';
import { isKycStatus } from '../../../../domain/model/kyc-status.enum.js';
import { CorruptedDataException } from '../../../../domain/exception/corrupted-data.exception.js';
import { ProProfileEntity } from '../entities/pro-profile.entity.js';

export class ProProfileMapper {
  static toDomain(entity: ProProfileEntity): ProProfile {
    if (!isKycStatus(entity.kycStatus)) {
      throw new CorruptedDataException(
        `invalid kyc_status value in pro_profiles row: ${entity.kycStatus}`,
      );
    }
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
        country: entity.address.country as 'FR',
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
    entity.kycDecisionAt = null;
    entity.kycDecisionBy = null;
    entity.kycDecisionReason = null;
    entity.inseeDenomination = aggregate.insee.legalName;
    entity.inseeIncorporationDate = aggregate.insee.incorporationDate;
    entity.inseeLegalCategory = aggregate.insee.legalCategory;
    entity.inseeCheckedAt = new Date();
    entity.createdAt = aggregate.createdAt;
    entity.updatedAt = aggregate.updatedAt;
    entity.deletedAt = aggregate.deletedAt;
    return entity;
  }
}
