import { Inject, Injectable } from '@nestjs/common';
import type {
  IInseeSiretValidator,
  InseeSiretSnapshot,
} from '../../../domain/ports/insee-siret-validator.port.js';
import {
  InseeSiretNotFoundError,
  InseeRateLimitError,
  InseeUnreachableError,
} from '../../../domain/ports/insee-siret-validator.port.js';
import type { Siret } from '../../../domain/model/siret.value-object.js';
import type { IConfigService } from '../../../domain/ports/config.port.js';
import { CONFIG_SERVICE } from '../../../domain/ports/tokens.js';

/** INSEE SIRENE V3.11 API response shape (partial). */
interface InseeEtablissementResponse {
  etablissement: {
    uniteLegale: {
      etatAdministratifUniteLegale: 'A' | 'C';
      denominationUniteLegale: string | null;
      dateCreationUniteLegale: string | null;
      categorieJuridiqueUniteLegale: string | null;
    };
  };
}

const TIMEOUT_MS = 5_000;

@Injectable()
export class InseeSiretValidatorService implements IInseeSiretValidator {
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(@Inject(CONFIG_SERVICE) config: IConfigService) {
    const inseeConfig = config.getInseeConfig();
    this.apiUrl = inseeConfig.apiUrl;
    this.apiKey = inseeConfig.apiKey;
  }

  async validate(siret: Siret): Promise<InseeSiretSnapshot> {
    const url = `${this.apiUrl}/api-sirene/3.11/siret/${siret.asString}`;
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          'X-INSEE-Api-Key-Integration': this.apiKey,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new InseeUnreachableError(
        `INSEE SIRENE API unreachable (network error)`,
        err,
      );
    }

    if (response.status === 404) {
      throw new InseeSiretNotFoundError(siret.asString);
    }

    if (response.status === 429) {
      const resetHeader = response.headers.get('x-rate-limit-reset');
      const resetMs = resetHeader
        ? parseInt(resetHeader, 10)
        : Date.now() + 60_000;
      const retryAfterMs = Math.max(0, resetMs - Date.now());
      throw new InseeRateLimitError(retryAfterMs);
    }

    if (response.status === 401 || response.status === 403) {
      throw new InseeUnreachableError(
        `INSEE SIRENE API authentication failed (status ${response.status})`,
      );
    }

    if (response.status >= 500) {
      throw new InseeUnreachableError(
        `INSEE SIRENE API server error (status ${response.status})`,
      );
    }

    if (!response.ok) {
      throw new InseeUnreachableError(
        `INSEE SIRENE API unexpected status ${response.status}`,
      );
    }

    let body: InseeEtablissementResponse;
    try {
      body = (await response.json()) as InseeEtablissementResponse;
    } catch (err) {
      throw new InseeUnreachableError(
        'INSEE SIRENE API returned non-JSON response',
        err,
      );
    }

    const uniteLegale = body.etablissement.uniteLegale;
    const administrativeStatus =
      uniteLegale.etatAdministratifUniteLegale === 'A' ? 'active' : 'ceased';

    return {
      administrativeStatus,
      legalName: uniteLegale.denominationUniteLegale ?? null,
      incorporationDate: uniteLegale.dateCreationUniteLegale ?? null,
      legalCategory: uniteLegale.categorieJuridiqueUniteLegale ?? null,
    };
  }
}
