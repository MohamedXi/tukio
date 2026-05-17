import { ProProfile, type RegisterProProps } from './pro-profile.aggregate.js';
import { Address } from './address.value-object.js';
import { PhoneNumber } from './phone-number.value-object.js';
import { Siret } from './siret.value-object.js';
import { VatNumber } from './vat-number.value-object.js';
import { KycStatus } from './kyc-status.enum.js';
import { InvalidProProfileException } from '../exception/invalid-pro-profile.exception.js';

const SIRET = Siret.create('35600000000048');
const ADDRESS = Address.create({
  street: '9 rue du Colonel Pierre Avia',
  postalCode: '75015',
  city: 'Paris',
  country: 'FR',
});
const PHONE = PhoneNumber.create('+33612345678');

const BASE_CONVERSION = {
  dateOfBirth: '1990-06-15',
  legalForm: 'SAS_SASU',
  vatStatus: 'vat_registered',
  categories: ['tents_marquees'],
  serviceZone: { city: 'Nantes', radiusKm: 80 },
} as const;

const baseRegisterProps: RegisterProProps = {
  userProfileId: '00000000-0000-4000-8000-000000000001',
  companyName: 'Acme SAS',
  siret: SIRET,
  address: ADDRESS,
  contactPhone: PHONE,
  kyc: {
    idCardR2Key: 'pro/00000000-0000-4000-8000-000000000001/id-card.jpg',
    ribR2Key: 'pro/00000000-0000-4000-8000-000000000001/rib.pdf',
    kbisR2Key: 'pro/00000000-0000-4000-8000-000000000001/kbis.pdf',
  },
  inseeAdministrativeStatus: 'active' as const,
  insee: {
    legalName: 'LA POSTE',
    incorporationDate: '1991-01-01',
    legalCategory: '5510',
    naf: '5310Z',
  },
  conversion: BASE_CONVERSION,
  now: new Date('2026-05-16T10:00:00.000Z'),
};

describe('ProProfile.register', () => {
  it('creates a Pro profile with kycStatus pending_review', () => {
    const p = ProProfile.register(baseRegisterProps);
    expect(p.kycStatus).toBe(KycStatus.PENDING_REVIEW);
    expect(p.isPendingReview()).toBe(true);
    expect(p.isApproved()).toBe(false);
    expect(p.isRejected()).toBe(false);
  });

  it('persists all the input fields verbatim', () => {
    const p = ProProfile.register(baseRegisterProps);
    expect(p.userProfileId).toBe(baseRegisterProps.userProfileId);
    expect(p.companyName).toBe('Acme SAS');
    expect(p.siret.equals(SIRET)).toBe(true);
    expect(p.address.equals(ADDRESS)).toBe(true);
    expect(p.contactPhone.equals(PHONE)).toBe(true);
    expect(p.vatNumber).toBeNull();
    expect(p.kyc.idCardR2Key).toBe(baseRegisterProps.kyc.idCardR2Key);
    expect(p.insee.legalName).toBe('LA POSTE');
  });

  it('accepts an optional VAT number', () => {
    const vat = VatNumber.create('FR12345678901');
    const p = ProProfile.register({ ...baseRegisterProps, vatNumber: vat });
    expect(p.vatNumber?.asString).toBe('FR12345678901');
  });

  it('accepts a null kbisR2Key (kbis is optional in the form)', () => {
    const p = ProProfile.register({
      ...baseRegisterProps,
      kyc: { ...baseRegisterProps.kyc, kbisR2Key: null },
    });
    expect(p.kyc.kbisR2Key).toBeNull();
  });

  it('generates an id when none is provided', () => {
    const p1 = ProProfile.register(baseRegisterProps);
    const p2 = ProProfile.register(baseRegisterProps);
    expect(p1.id).not.toBe(p2.id);
    expect(p1.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('uses the provided id and now when supplied (deterministic for tests)', () => {
    const id = '12345678-1234-4234-8234-123456789012';
    const now = new Date('2026-05-16T10:00:00.000Z');
    const p = ProProfile.register({ ...baseRegisterProps, id, now });
    expect(p.id).toBe(id);
    expect(p.createdAt).toEqual(now);
    expect(p.updatedAt).toEqual(now);
  });

  it('sets deletedAt to null on a fresh registration', () => {
    const p = ProProfile.register(baseRegisterProps);
    expect(p.deletedAt).toBeNull();
    expect(p.isDeleted()).toBe(false);
  });

  it('trims surrounding whitespace from companyName', () => {
    const p = ProProfile.register({
      ...baseRegisterProps,
      companyName: '   Acme SAS   ',
    });
    expect(p.companyName).toBe('Acme SAS');
  });

  it('throws InvalidProProfileException when inseeAdministrativeStatus is not active (D1 invariant)', () => {
    // Cast through `unknown` because the type was narrowed to `'active'`
    // (Story 1.3b review P20); the runtime guard still self-protects.
    expect(() =>
      ProProfile.register({
        ...baseRegisterProps,
        inseeAdministrativeStatus: 'ceased' as unknown as 'active',
      }),
    ).toThrow(InvalidProProfileException);
  });

  it('records the INSEE checkedAt timestamp at registration time', () => {
    const now = new Date('2026-05-16T10:00:00.000Z');
    const p = ProProfile.register({ ...baseRegisterProps, now });
    expect(p.insee.checkedAt).toEqual(now);
  });

  it('preserves the NAF code captured at registration', () => {
    const p = ProProfile.register(baseRegisterProps);
    expect(p.insee.naf).toBe('5310Z');
  });

  it('initialises kycDecision to all-null on a fresh registration', () => {
    const p = ProProfile.register(baseRegisterProps);
    expect(p.kycDecision.decidedAt).toBeNull();
    expect(p.kycDecision.decidedBy).toBeNull();
    expect(p.kycDecision.reason).toBeNull();
  });
});

describe('ProProfile.create (invariants)', () => {
  const minimalProps = {
    id: '12345678-1234-4234-8234-123456789012',
    userProfileId: '00000000-0000-4000-8000-000000000001',
    companyName: 'Acme SAS',
    siret: SIRET,
    vatNumber: null,
    address: ADDRESS,
    contactPhone: PHONE,
    kycStatus: KycStatus.PENDING_REVIEW,
    kyc: {
      idCardR2Key: 'pro/x/id-card.jpg',
      ribR2Key: 'pro/x/rib.pdf',
      kbisR2Key: null,
    },
    insee: {
      legalName: null,
      incorporationDate: null,
      legalCategory: null,
      naf: null,
      checkedAt: new Date('2026-05-16T10:00:00.000Z'),
    },
    kycDecision: {
      decidedAt: null,
      decidedBy: null,
      reason: null,
    },
    conversion: BASE_CONVERSION,
    createdAt: new Date('2026-05-16T10:00:00.000Z'),
    updatedAt: new Date('2026-05-16T10:00:00.000Z'),
    deletedAt: null,
  };

  it('rejects an empty id', () => {
    expect(() => ProProfile.create({ ...minimalProps, id: '' })).toThrow(
      InvalidProProfileException,
    );
  });

  it('rejects an empty userProfileId', () => {
    expect(() =>
      ProProfile.create({ ...minimalProps, userProfileId: '   ' }),
    ).toThrow(InvalidProProfileException);
  });

  it('rejects an empty companyName', () => {
    expect(() =>
      ProProfile.create({ ...minimalProps, companyName: '   ' }),
    ).toThrow(InvalidProProfileException);
  });

  it('rejects a companyName longer than 200 chars', () => {
    expect(() =>
      ProProfile.create({ ...minimalProps, companyName: 'X'.repeat(201) }),
    ).toThrow(InvalidProProfileException);
  });

  it('rejects an unknown kycStatus value', () => {
    expect(() =>
      ProProfile.create({
        ...minimalProps,
        kycStatus: 'unknown' as unknown as KycStatus,
      }),
    ).toThrow(InvalidProProfileException);
  });

  it('rejects an empty idCardR2Key', () => {
    expect(() =>
      ProProfile.create({
        ...minimalProps,
        kyc: { ...minimalProps.kyc, idCardR2Key: '' },
      }),
    ).toThrow(InvalidProProfileException);
  });

  it('rejects an empty ribR2Key', () => {
    expect(() =>
      ProProfile.create({
        ...minimalProps,
        kyc: { ...minimalProps.kyc, ribR2Key: '' },
      }),
    ).toThrow(InvalidProProfileException);
  });

  it('accepts a deleted Pro (deletedAt set)', () => {
    const deletedAt = new Date('2026-05-20T00:00:00.000Z');
    const p = ProProfile.create({ ...minimalProps, deletedAt });
    expect(p.isDeleted()).toBe(true);
  });
});
