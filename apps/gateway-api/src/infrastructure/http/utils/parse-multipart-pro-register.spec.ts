import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { ZodError } from 'zod';
import { parseMultipartProRegister } from './parse-multipart-pro-register.js';

interface FakeFilePart {
  type: 'file';
  fieldname: string;
  mimetype: string;
  filename: string;
  buffer: Buffer;
  resumed: boolean;
}

interface FakeFieldPart {
  type: 'field';
  fieldname: string;
  value: string;
}

type Part = FakeFilePart | FakeFieldPart;

function makeFilePart(
  fieldname: string,
  mimetype: string,
  filename: string,
  buffer: Buffer,
): FakeFilePart & {
  file: { resume: () => void };
  toBuffer: () => Promise<Buffer>;
} {
  const part = {
    type: 'file' as const,
    fieldname,
    mimetype,
    filename,
    buffer,
    resumed: false,
    file: {
      resume(): void {
        part.resumed = true;
      },
    },
    toBuffer(): Promise<Buffer> {
      return Promise.resolve(buffer);
    },
  };
  return part;
}

function makeFieldPart(fieldname: string, value: string): FakeFieldPart {
  return { type: 'field', fieldname, value };
}

function buildRequest(parts: Part[]): {
  isMultipart: () => boolean;
  parts: () => AsyncIterableIterator<unknown>;
} {
  return {
    isMultipart: () => true,
    parts: async function* (): AsyncIterableIterator<unknown> {
      // Trivial await keeps eslint's require-await happy; the test harness
      // is intentionally synchronous-looking but matches the async iterator
      // shape exposed by @fastify/multipart.
      await Promise.resolve();
      for (const p of parts) {
        yield p;
      }
    },
  };
}

// Story 1.3b-bis: DTO now uses conversion wizard fields (no password/acceptTerms).
const validPayload = {
  email: 'pro@example.com',
  firstName: 'Jean',
  lastName: 'Dupont',
  locale: 'fr',
  dateOfBirth: '1990-06-15',
  acceptMarketing: false,
  companyName: 'Pro SAS',
  siret: '73282932000074',
  vatStatus: 'vat_registered',
  legalForm: 'SAS_SASU',
  categories: ['tents_marquees'],
  serviceZone: { city: 'Nantes', radiusKm: 80 },
  address: {
    street: '1 rue de la République',
    postalCode: '44000',
    city: 'Nantes',
    country: 'FR',
  },
  contactPhone: '+33612345678',
  acceptCharter: true,
};

describe('parseMultipartProRegister', () => {
  it('parses a valid multipart body with required idCard + rib (no kbisOrInsee)', async () => {
    const req = buildRequest([
      makeFieldPart('payload', JSON.stringify(validPayload)),
      makeFilePart('idCard', 'image/jpeg', 'id.jpg', Buffer.from('idcard')),
      makeFilePart('rib', 'application/pdf', 'rib.pdf', Buffer.from('rib')),
    ]);

    const result = await parseMultipartProRegister(req);

    expect(result.payload.email).toBe('pro@example.com');
    expect(result.payload.siret).toBe('73282932000074');
    expect(result.files.idCard.originalName).toBe('id.jpg');
    expect(result.files.rib.contentType).toBe('application/pdf');
    expect(result.files.kbisOrInsee).toBeUndefined();
  });

  it('includes the optional kbisOrInsee file when present', async () => {
    const req = buildRequest([
      makeFieldPart('payload', JSON.stringify(validPayload)),
      makeFilePart('idCard', 'image/jpeg', 'id.jpg', Buffer.from('idcard')),
      makeFilePart('rib', 'application/pdf', 'rib.pdf', Buffer.from('rib')),
      makeFilePart(
        'kbisOrInsee',
        'application/pdf',
        'kbis.pdf',
        Buffer.from('kbis'),
      ),
    ]);

    const result = await parseMultipartProRegister(req);

    expect(result.files.kbisOrInsee?.originalName).toBe('kbis.pdf');
  });

  it('rejects requests that are not multipart', async () => {
    await expect(
      parseMultipartProRegister({
        isMultipart: () => false,
        parts: async function* () {
          await Promise.resolve();
          yield undefined;
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when the payload field is missing', async () => {
    const req = buildRequest([
      makeFilePart('idCard', 'image/jpeg', 'id.jpg', Buffer.from('idcard')),
      makeFilePart('rib', 'application/pdf', 'rib.pdf', Buffer.from('rib')),
    ]);
    await expect(parseMultipartProRegister(req)).rejects.toThrow(
      /Missing `payload`/,
    );
  });

  it('rejects when payload appears twice', async () => {
    const req = buildRequest([
      makeFieldPart('payload', JSON.stringify(validPayload)),
      makeFieldPart('payload', JSON.stringify(validPayload)),
      makeFilePart('idCard', 'image/jpeg', 'id.jpg', Buffer.from('idcard')),
      makeFilePart('rib', 'application/pdf', 'rib.pdf', Buffer.from('rib')),
    ]);
    await expect(parseMultipartProRegister(req)).rejects.toThrow(
      /Duplicate `payload`/,
    );
  });

  it('rejects when payload is not valid JSON', async () => {
    const req = buildRequest([
      makeFieldPart('payload', '{not-json'),
      makeFilePart('idCard', 'image/jpeg', 'id.jpg', Buffer.from('idcard')),
      makeFilePart('rib', 'application/pdf', 'rib.pdf', Buffer.from('rib')),
    ]);
    await expect(parseMultipartProRegister(req)).rejects.toThrow(
      /not valid JSON/,
    );
  });

  it('surfaces a ZodError when payload fails RegisterProInputSchema (Luhn-invalid SIRET)', async () => {
    const req = buildRequest([
      makeFieldPart(
        'payload',
        JSON.stringify({ ...validPayload, siret: '12345678901235' }),
      ),
      makeFilePart('idCard', 'image/jpeg', 'id.jpg', Buffer.from('idcard')),
      makeFilePart('rib', 'application/pdf', 'rib.pdf', Buffer.from('rib')),
    ]);
    await expect(parseMultipartProRegister(req)).rejects.toBeInstanceOf(
      ZodError,
    );
  });

  it('rejects unknown file fieldnames with BadRequestException', async () => {
    const stray = makeFilePart(
      'malicious',
      'image/jpeg',
      'x.jpg',
      Buffer.from('x'),
    );
    const req = buildRequest([
      makeFieldPart('payload', JSON.stringify(validPayload)),
      makeFilePart('idCard', 'image/jpeg', 'id.jpg', Buffer.from('idcard')),
      makeFilePart('rib', 'application/pdf', 'rib.pdf', Buffer.from('rib')),
      stray,
    ]);
    await expect(parseMultipartProRegister(req)).rejects.toThrow(
      /Unknown file field/,
    );
    expect(stray.resumed).toBe(true);
  });

  it('rejects duplicate file fields (idCard sent twice)', async () => {
    const dup = makeFilePart(
      'idCard',
      'image/jpeg',
      'id2.jpg',
      Buffer.from('id2'),
    );
    const req = buildRequest([
      makeFieldPart('payload', JSON.stringify(validPayload)),
      makeFilePart('idCard', 'image/jpeg', 'id.jpg', Buffer.from('idcard')),
      dup,
      makeFilePart('rib', 'application/pdf', 'rib.pdf', Buffer.from('rib')),
    ]);
    await expect(parseMultipartProRegister(req)).rejects.toThrow(
      /Duplicate file field/,
    );
    expect(dup.resumed).toBe(true);
  });

  it('rejects a file with disallowed MIME type (text/plain)', async () => {
    const bad = makeFilePart(
      'idCard',
      'text/plain',
      'id.txt',
      Buffer.from('idcard'),
    );
    const req = buildRequest([
      makeFieldPart('payload', JSON.stringify(validPayload)),
      bad,
      makeFilePart('rib', 'application/pdf', 'rib.pdf', Buffer.from('rib')),
    ]);
    await expect(parseMultipartProRegister(req)).rejects.toThrow(
      /disallowed MIME type/,
    );
    expect(bad.resumed).toBe(true);
  });

  it('rejects when idCard is missing', async () => {
    const req = buildRequest([
      makeFieldPart('payload', JSON.stringify(validPayload)),
      makeFilePart('rib', 'application/pdf', 'rib.pdf', Buffer.from('rib')),
    ]);
    await expect(parseMultipartProRegister(req)).rejects.toThrow(
      /Missing required file field: idCard/,
    );
  });

  it('rejects when rib is missing', async () => {
    const req = buildRequest([
      makeFieldPart('payload', JSON.stringify(validPayload)),
      makeFilePart('idCard', 'image/jpeg', 'id.jpg', Buffer.from('idcard')),
    ]);
    await expect(parseMultipartProRegister(req)).rejects.toThrow(
      /Missing required file field: rib/,
    );
  });

  it.each([
    'FST_REQ_FILE_TOO_LARGE',
    'FST_FILES_LIMIT',
    'FST_PARTS_LIMIT',
    'FST_FIELDS_LIMIT',
  ])(
    'translates @fastify/multipart %s into a 413 PayloadTooLargeException',
    async (errorCode: string) => {
      const fastifyErr = Object.assign(new Error('Multipart limit exceeded'), {
        code: errorCode,
      });
      const req = {
        isMultipart: () => true,
        parts: async function* (): AsyncIterableIterator<unknown> {
          await Promise.resolve();
          yield {
            type: 'file' as const,
            fieldname: 'idCard',
            mimetype: 'image/jpeg',
            filename: 'big.jpg',
            file: { resume: (): void => undefined },
            toBuffer: (): Promise<Buffer> => Promise.reject(fastifyErr),
          };
        },
      };

      await expect(parseMultipartProRegister(req)).rejects.toBeInstanceOf(
        PayloadTooLargeException,
      );
    },
  );
});
