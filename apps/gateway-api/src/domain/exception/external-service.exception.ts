import { DomainException } from './domain.exception.js';

/**
 * Downstream service is unreachable / timing out / 5xx-after-retries. Surfaces
 * as 502 Bad Gateway with the stable tukioCode the frontend can map to a
 * generic "service unavailable" message. Story 1.2c.
 */
export class ExternalServiceException extends DomainException {
  readonly tukioCode = 'IDENTITY-EXTERNAL-001';
  readonly httpStatus = 502;
  readonly title = 'External service unavailable';

  constructor(message: string) {
    super(message);
  }
}
