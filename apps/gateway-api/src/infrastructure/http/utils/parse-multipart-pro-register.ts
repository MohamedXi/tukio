import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import type { MultipartFile, MultipartValue } from '@fastify/multipart';
import {
  RegisterProInputSchema,
  type RegisterProInputDto,
} from '@tukio/contracts/dtos/identity/register-pro';
import type { RegisterProForwardedFile } from '../../../domain/ports/identity-svc.port.js';

/**
 * FastifyError codes emitted by @fastify/multipart when limits are exceeded.
 * All carry `statusCode: 413` in the library but are not HttpExceptions, so
 * they bypass NestJS's HttpException handling and would surface as 500 without
 * explicit translation here (Story 1.3c code-review P1).
 */
const FASTIFY_MULTIPART_LIMIT_CODES = new Set([
  'FST_REQ_FILE_TOO_LARGE', // per-file size > limits.fileSize
  'FST_FILES_LIMIT', // number of files > limits.files
  'FST_PARTS_LIMIT', // number of parts (files + fields) > limits.parts
  'FST_FIELDS_LIMIT', // number of field parts > limits.fields
]);

function isFastifyMultipartLimitError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    FASTIFY_MULTIPART_LIMIT_CODES.has(String((err as { code?: unknown }).code))
  );
}

// Structural type — avoids declaring `fastify` as a direct dep of gateway-api
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
 * Strip directory separators, non-printable characters, and anything outside
 * `[a-z0-9._-]` (case-insensitive) from a client-supplied filename. Falls back
 * to `'upload'` if nothing useful remains after sanitization.
 */
function sanitizeFilename(raw: string | null | undefined): string {
  const base = (raw ?? '').replace(/.*[\\/]/u, '');
  const safe = base.replace(/[^a-zA-Z0-9._-]/gu, '_').slice(0, 200);
  return safe.length > 0 ? safe : 'upload';
}

export interface ParsedRegisterProRequest {
  payload: RegisterProInputDto;
  files: {
    idCard: RegisterProForwardedFile;
    rib: RegisterProForwardedFile;
    kbisOrInsee?: RegisterProForwardedFile;
  };
}

/**
 * Parses a multipart/form-data request for `POST /v1/auth/pro/register`
 * (Story 1.3c). Mirrors the identity-svc 1.3b parser so the same field
 * names and validation contract hold on both ends.
 *
 * Expected parts:
 *   - `payload` (field): JSON string matching `RegisterProInputSchema`
 *   - `idCard`   (file): required — identity document (JPEG/PNG/PDF, ≤ 5 MB)
 *   - `rib`      (file): required — RIB/IBAN proof
 *   - `kbisOrInsee` (file): optional — KBIS or INSEE printout
 */
export async function parseMultipartProRegister(
  req: MultipartRequest,
): Promise<ParsedRegisterProRequest> {
  if (!req.isMultipart()) {
    throw new BadRequestException('Expected multipart/form-data');
  }

  let payloadJson: string | undefined;
  const uploadedFiles: Partial<Record<FileField, RegisterProForwardedFile>> =
    {};

  // Limits are also enforced at the @fastify/multipart registration level in
  // main.ts. Repeating here documents the parser-side contract.
  const parts = req.parts({ limits: { fileSize: 5 * 1024 * 1024 } });
  try {
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
          // Guard against silent truncation at `limits.fieldSize` (1 MB in
          // main.ts). busboy truncates silently; @fastify/multipart exposes
          // `valueTruncated` on the field part. A truncated JSON payload would
          // produce a misleading "not valid JSON" 400 — raise 413 instead.
          const truncated = (fieldPart as { valueTruncated?: boolean })
            .valueTruncated;
          if (truncated === true) {
            throw new PayloadTooLargeException(
              '`payload` JSON field exceeds the 1 MB field-size limit',
            );
          }
          payloadJson = fieldPart.value;
        }
        // Other field names are ignored. The @fastify/multipart parts cap in
        // main.ts already bounds the total count.
      } else {
        const filePart = rawPart as MultipartFile;
        if (!isFileField(filePart.fieldname)) {
          filePart.file.resume();
          throw new BadRequestException(
            `Unknown file field: ${filePart.fieldname}`,
          );
        }
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
          // Sanitize the client-supplied filename before forwarding to
          // identity-svc (Story 1.3c code-review P3). The raw `filename`
          // header is untrusted: path-traversal sequences (../../etc/passwd)
          // and non-ASCII characters are stripped.
          originalName: sanitizeFilename(filePart.filename),
        };
      }
    }
  } catch (err) {
    // Translate @fastify/multipart limit errors into clean 413 responses.
    // Without this, raw FastifyErrors (which are not HttpExceptions) leak
    // through EnvelopeExceptionFilter as 500 INTERNAL-SERVER-ERROR-001.
    // Covers: file too large, too many files, too many parts, too many fields.
    if (isFastifyMultipartLimitError(err)) {
      throw new PayloadTooLargeException(
        'Multipart request exceeds allowed limits (5 MB per file, 3 files, 5 parts)',
      );
    }
    throw err;
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
    // Surface the raw ZodError so EnvelopeExceptionFilter maps it to the
    // canonical 422 VALIDATION-FAILED-001 envelope with the `issues[]` array
    // (identical UX to the JSON customer register case).
    throw parsed.error;
  }

  return {
    payload: parsed.data,
    files: {
      idCard: uploadedFiles.idCard,
      rib: uploadedFiles.rib,
      ...(uploadedFiles.kbisOrInsee && {
        kbisOrInsee: uploadedFiles.kbisOrInsee,
      }),
    },
  };
}
