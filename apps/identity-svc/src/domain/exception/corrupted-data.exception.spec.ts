import { CorruptedDataException } from './corrupted-data.exception.js';
import { DomainException } from './domain.exception.js';

describe('CorruptedDataException', () => {
  it('extends DomainException', () => {
    const ex = new CorruptedDataException('test');
    expect(ex).toBeInstanceOf(DomainException);
  });

  it('carries the canonical Tukio error code', () => {
    const ex = new CorruptedDataException('bad row');
    expect(ex.tukioCode).toBe('DATA-INTEGRITY-ERROR-001');
  });

  it('maps to HTTP 500 (server-side data integrity issue)', () => {
    const ex = new CorruptedDataException('bad row');
    expect(ex.httpStatus).toBe(500);
  });

  it('renders a stable title for clients', () => {
    const ex = new CorruptedDataException('bad row');
    expect(ex.title).toBe('Data integrity error');
  });

  it('includes the reason in the exception message', () => {
    const ex = new CorruptedDataException('unrecognised role value');
    expect(ex.message).toContain('unrecognised role value');
  });
});
