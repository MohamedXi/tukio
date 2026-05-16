import nock from 'nock';
import { InseeSiretValidatorService } from './insee-siret-validator.service.js';
import {
  InseeSiretNotFoundError,
  InseeRateLimitError,
  InseeUnreachableError,
} from '../../../domain/ports/insee-siret-validator.port.js';
import { Siret } from '../../../domain/model/siret.value-object.js';
import type { IConfigService } from '../../../domain/ports/config.port.js';

const MOCK_SIRET = '35600000000048';
const API_URL = 'https://api.insee.test';
const API_KEY = 'test-api-key';

function makeService(): InseeSiretValidatorService {
  const config = {
    getInseeConfig: () => ({ apiUrl: API_URL, apiKey: API_KEY }),
  } as unknown as IConfigService;
  return new InseeSiretValidatorService(config);
}

function makeActiveSiretPayload(siret: string = MOCK_SIRET) {
  return {
    etablissement: {
      siret,
      uniteLegale: {
        etatAdministratifUniteLegale: 'A',
        denominationUniteLegale: 'ACME SAS',
        dateCreationUniteLegale: '2020-01-15',
        categorieJuridiqueUniteLegale: '5710',
      },
    },
  };
}

describe('InseeSiretValidatorService (integration — nock)', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it('returns active snapshot for a live active SIRET', async () => {
    nock(API_URL)
      .get(`/api-sirene/3.11/siret/${MOCK_SIRET}`)
      .matchHeader('X-INSEE-Api-Key-Integration', API_KEY)
      .reply(200, makeActiveSiretPayload());

    const svc = makeService();
    const snap = await svc.validate(Siret.create(MOCK_SIRET));

    expect(snap.administrativeStatus).toBe('active');
    expect(snap.legalName).toBe('ACME SAS');
    expect(snap.incorporationDate).toBe('2020-01-15');
    expect(snap.legalCategory).toBe('5710');
  });

  it('returns ceased snapshot for an inactive SIRET (etat=C)', async () => {
    const payload = makeActiveSiretPayload();
    payload.etablissement.uniteLegale.etatAdministratifUniteLegale = 'C';

    nock(API_URL)
      .get(`/api-sirene/3.11/siret/${MOCK_SIRET}`)
      .reply(200, payload);

    const svc = makeService();
    const snap = await svc.validate(Siret.create(MOCK_SIRET));
    expect(snap.administrativeStatus).toBe('ceased');
  });

  it('throws InseeSiretNotFoundError on 404', async () => {
    nock(API_URL)
      .get(`/api-sirene/3.11/siret/${MOCK_SIRET}`)
      .reply(404, { message: 'Aucun établissement trouvé' });

    const svc = makeService();
    await expect(svc.validate(Siret.create(MOCK_SIRET))).rejects.toBeInstanceOf(
      InseeSiretNotFoundError,
    );
  });

  it('throws InseeRateLimitError on 429 with parsed retryAfterMs', async () => {
    const resetTimestamp = Date.now() + 30_000;
    nock(API_URL)
      .get(`/api-sirene/3.11/siret/${MOCK_SIRET}`)
      .reply(
        429,
        { message: 'Too Many Requests' },
        {
          'x-rate-limit-reset': String(resetTimestamp),
        },
      );

    const svc = makeService();
    const err = await svc
      .validate(Siret.create(MOCK_SIRET))
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InseeRateLimitError);
    expect((err as InseeRateLimitError).retryAfterMs).toBeGreaterThan(0);
  });

  it('throws InseeUnreachableError on 401 (invalid apiKey)', async () => {
    nock(API_URL)
      .get(`/api-sirene/3.11/siret/${MOCK_SIRET}`)
      .reply(401, { message: 'Unauthorized' });

    const svc = makeService();
    await expect(svc.validate(Siret.create(MOCK_SIRET))).rejects.toBeInstanceOf(
      InseeUnreachableError,
    );
  });

  it('throws InseeUnreachableError on 500 (server error)', async () => {
    nock(API_URL)
      .get(`/api-sirene/3.11/siret/${MOCK_SIRET}`)
      .reply(503, { message: 'Service Unavailable' });

    const svc = makeService();
    await expect(svc.validate(Siret.create(MOCK_SIRET))).rejects.toBeInstanceOf(
      InseeUnreachableError,
    );
  });

  it('throws InseeUnreachableError on network timeout', async () => {
    nock(API_URL)
      .get(`/api-sirene/3.11/siret/${MOCK_SIRET}`)
      .delayConnection(6_000)
      .reply(200, makeActiveSiretPayload());

    const svc = makeService();
    await expect(svc.validate(Siret.create(MOCK_SIRET))).rejects.toBeInstanceOf(
      InseeUnreachableError,
    );
  }, 10_000);

  it('handles null denomination (individual entrepreneur)', async () => {
    const payload = makeActiveSiretPayload();
    payload.etablissement.uniteLegale.denominationUniteLegale =
      null as unknown as string;

    nock(API_URL)
      .get(`/api-sirene/3.11/siret/${MOCK_SIRET}`)
      .reply(200, payload);

    const svc = makeService();
    const snap = await svc.validate(Siret.create(MOCK_SIRET));
    expect(snap.legalName).toBeNull();
  });
});
