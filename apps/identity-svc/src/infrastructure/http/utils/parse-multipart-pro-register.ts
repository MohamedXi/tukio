import { BadRequestException } from '@nestjs/common';
import type { MultipartFile, MultipartValue } from '@fastify/multipart';
import { RegisterProInputSchema } from '@tukio/contracts/dtos/identity/register-pro';
import type {
  RegisterProUseCaseInput,
  RegisterProFile,
} from '../../../usecases/register-pro.usecase.js';

// Structural type — avoids declaring `fastify` as a direct dep of identity-svc
// (it arrives transitively via @nestjs/platform-fastify + @fastify/multipart).
// The `parts()` return is typed as `unknown` at the boundary; internal casts
// (`as MultipartFile`, `as MultipartValue<string>`) narrow to the specific type.
interface MultipartRequest {
  isMultipart: () => boolean;
  parts: (options?: {
    limits?: { fileSize?: number };
  }) => AsyncIterableIterator<unknown>;
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'application/pdf',
]);

const FILE_FIELDS = ['idCard', 'rib', 'kbisOrInsee'] as const;
type FileField = (typeof FILE_FIELDS)[number];

function isFileField(name: string): name is FileField {
  return FILE_FIELDS.includes(name as FileField);
}

/**
 * Parses a multipart/form-data request for `POST /internal/pros`.
 *
 * Expected parts:
 *   - `payload` (field): JSON string matching `RegisterProInputSchema`
 *   - `idCard`   (file): required — identity document (JPEG/PNG/PDF, ≤ 5 MB)
 *   - `rib`      (file): required — RIB/IBAN proof
 *   - `kbisOrInsee` (file): optional — KBIS or INSEE printout
 */
export async function parseMultipartProRegister(
  req: MultipartRequest,
): Promise<Omit<RegisterProUseCaseInput, 'correlationId'>> {
  if (!req.isMultipart()) {
    throw new BadRequestException('Expected multipart/form-data');
  }

  let payloadJson: string | undefined;
  const uploadedFiles: Partial<Record<FileField, RegisterProFile>> = {};

  // Limits are also enforced at the @fastify/multipart registration level in
  // main.ts (P2/P7). Repeating here documents the parser-side contract.
  const parts = req.parts({ limits: { fileSize: 5 * 1024 * 1024 } });
  for await (const rawPart of parts) {
    const part = rawPart as { type: string };
    if (part.type === 'field') {
      const fieldPart = rawPart as MultipartValue<string>;
      if (fieldPart.fieldname === 'payload') {
        if (payloadJson !== undefined) {
          throw new BadRequestException(
            'Duplicate `payload` field in multipart body',
          );
        }
        payloadJson = fieldPart.value;
      }
      // Other field names (non-`payload`) are ignored. The @fastify/multipart
      // `parts` cap at main.ts already bounds the total count.
    } else {
      const filePart = rawPart as MultipartFile;
      // P8 — reject unknown file fieldnames explicitly (was: silently consumed
      // via .resume()/continue). Bandwidth still spent reading the part, but
      // the caller gets a clear 400 instead of a misleading silent success.
      if (!isFileField(filePart.fieldname)) {
        filePart.file.resume();
        throw new BadRequestException(
          `Unknown file field: ${filePart.fieldname}`,
        );
      }
      // P9 — reject duplicate file fields (same fieldname twice). Without this
      // the second part silently overwrote the first, masking smuggle attempts.
      if (uploadedFiles[filePart.fieldname] !== undefined) {
        filePart.file.resume();
        throw new BadRequestException(
          `Duplicate file field: ${filePart.fieldname}`,
        );
      }
      if (!ALLOWED_MIME_TYPES.has(filePart.mimetype)) {
        filePart.file.resume();
        throw new BadRequestException(
          `File ${filePart.fieldname} has disallowed MIME type: ${filePart.mimetype}`,
        );
      }
      const buffer = await filePart.toBuffer();
      uploadedFiles[filePart.fieldname] = {
        buffer,
        contentType: filePart.mimetype,
        originalName: filePart.filename,
      };
    }
  }

  if (!payloadJson) {
    throw new BadRequestException(
      'Missing `payload` JSON field in multipart body',
    );
  }
  if (!uploadedFiles.idCard) {
    throw new BadRequestException('Missing required file field: idCard');
  }
  if (!uploadedFiles.rib) {
    throw new BadRequestException('Missing required file field: rib');
  }

  let payload: unknown;
  try {
    payload = JSON.parse(payloadJson);
  } catch {
    throw new BadRequestException('`payload` field is not valid JSON');
  }

  const parsed = RegisterProInputSchema.safeParse(payload);
  if (!parsed.success) {
    throw new BadRequestException(
      `Invalid payload: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
    );
  }

  return {
    ...parsed.data,
    files: {
      idCard: uploadedFiles.idCard,
      rib: uploadedFiles.rib,
      ...(uploadedFiles.kbisOrInsee && {
        kbisOrInsee: uploadedFiles.kbisOrInsee,
      }),
    },
  };
}
