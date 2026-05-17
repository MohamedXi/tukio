import { BadRequestException } from '@nestjs/common';
import type { MultipartFile, MultipartValue } from '@fastify/multipart';
import { RegisterProInputSchema } from '@tukio/contracts/dtos/identity/register-pro';
import type {
  ConvertCustomerToProInput,
  ConvertCustomerToProFile,
} from '../../../usecases/convert-customer-to-pro.usecase.js';

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
 * Parses a multipart/form-data request for `POST /internal/pros` (Story 1.3b-bis).
 *
 * Expected parts:
 *   - `payload` (field): JSON string matching `RegisterProInputSchema`. The `userId`
 *     field is injected by gateway-api from the authenticated JWT `sub`.
 *   - `idCard`   (file): required — identity document (JPEG/PNG/PDF, ≤ 5 MB)
 *   - `rib`      (file): required — RIB/IBAN proof
 *   - `kbisOrInsee` (file): optional — KBIS or INSEE printout
 */
export async function parseMultipartProRegister(
  req: MultipartRequest,
): Promise<Omit<ConvertCustomerToProInput, 'correlationId'>> {
  if (!req.isMultipart()) {
    throw new BadRequestException('Expected multipart/form-data');
  }

  let payloadJson: string | undefined;
  const uploadedFiles: Partial<Record<FileField, ConvertCustomerToProFile>> =
    {};

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

  // Extract `userId` from the raw payload BEFORE Zod validation (Zod strips
  // unknown keys, so `userId` — injected by gateway-api from JWT sub — would
  // be silently discarded by `RegisterProInputSchema.safeParse`).
  const rawPayload = payload as Record<string, unknown>;
  const userId = rawPayload['userId'];
  const UUID_V4_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (
    typeof userId !== 'string' ||
    userId.trim().length === 0 ||
    !UUID_V4_RE.test(userId.trim())
  ) {
    throw new BadRequestException(
      'Missing or invalid `userId` in payload — must be a valid UUID v4 (JWT sub injected by gateway-api)',
    );
  }

  // Validate the rest of the fields against the contract DTO.
  const parsed = RegisterProInputSchema.safeParse(payload);
  if (!parsed.success) {
    throw new BadRequestException(
      `Invalid payload: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
    );
  }

  const dto = parsed.data;

  return {
    userId,
    // Identity fields from the wizard (may have been edited by the user — D1 decision).
    email: dto.email,
    firstName: dto.firstName,
    lastName: dto.lastName,
    dateOfBirth: dto.dateOfBirth,
    contactPhone: dto.contactPhone,
    acceptMarketing: dto.acceptMarketing,
    companyName: dto.companyName,
    siret: dto.siret,
    ...(dto.vatNumber !== undefined && { vatNumber: dto.vatNumber }),
    legalForm: dto.legalForm,
    vatStatus: dto.vatStatus,
    categories: [...dto.categories],
    serviceZone: dto.serviceZone,
    address: dto.address,
    acceptCharter: dto.acceptCharter,
    ...(dto.acquisition !== undefined && { acquisition: dto.acquisition }),
    files: {
      idCard: uploadedFiles.idCard,
      rib: uploadedFiles.rib,
      ...(uploadedFiles.kbisOrInsee && {
        kbisOrInsee: uploadedFiles.kbisOrInsee,
      }),
    },
  };
}
