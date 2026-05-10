import { DomainException } from './domain.exception.js';

// Thrown when the persistence layer returns data that violates domain invariants
// (e.g. a row with an unrecognised role value). This is a 500 — it signals a
// DB integrity problem, not a client error.
export class CorruptedDataException extends DomainException {
  readonly tukioCode = 'DATA-INTEGRITY-ERROR-001';
  readonly httpStatus = 500;
  readonly title = 'Data integrity error';

  constructor(reason: string) {
    super(`Corrupted data detected in persistence layer: ${reason}`);
  }
}
