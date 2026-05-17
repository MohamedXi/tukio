import { createHash, createHmac } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosResponse,
} from 'axios';
import axiosRetry from 'axios-retry';
import FormData from 'form-data';
import type {
  ForwardRegisterCustomerInput,
  ForwardRegisterProInput,
  IIdentitySvcClient,
} from '../../../domain/ports/identity-svc.port.js';
import type { IConfigService } from '../../../domain/ports/config.port.js';
import { CONFIG_SERVICE } from '../../../domain/ports/tokens.js';
import type { RegisterCustomerResponseDto } from '@tukio/contracts/dtos/identity/register-customer';
import type { RegisterProResponseDto } from '@tukio/contracts/dtos/identity/register-pro';
import type { ValidationIssue } from '@tukio/contracts/envelope';
import {
  IdentitySvcConflictError,
  IdentitySvcUnreachableError,
  IdentitySvcValidationError,
} from '../../../domain/ports/identity-svc.errors.js';

/**
 * Paths on identity-svc — both Nest apps use URI versioning (`/v1/...`).
 */
const REGISTER_CUSTOMER_PATH = '/v1/internal/customers';
const REGISTER_PRO_PATH = '/v1/internal/pros';

/**
 * Multipart upload cap : 3 files × 5 MB + payload field + envelope boundary.
 * Matches identity-svc `MAX_FILES_PER_REQUEST` × `MAX_FILE_SIZE_BYTES`
 * (5 MB) + 1 MB headroom for the JSON payload and the multipart envelope.
 */
const MULTIPART_MAX_CONTENT_LENGTH = 16 * 1024 * 1024;

/**
 * Sentinel body-hash for multipart/form-data forwards (Story 1.3b code-review
 * D1 — must match `MULTIPART_BODY_HASH_SENTINEL` in identity-svc
 * `InternalServiceGuard`). Fastify cannot expose the raw multipart body to the
 * guard before the controller invokes `req.parts()`, so the canonical signed
 * string binds (timestamp, method, path, sentinel) but NOT the body bytes.
 */
const MULTIPART_BODY_HASH_SENTINEL = createHash('sha256')
  .update('TUKIO_MULTIPART_NO_BODY_HASH')
  .digest('hex');

interface ErrorEnvelopeBody {
  error?: {
    tukioCode?: string;
    detail?: string;
    title?: string;
    issues?: ValidationIssue[];
  };
}

@Injectable()
export class IdentitySvcClient implements IIdentitySvcClient {
  private readonly http: AxiosInstance;
  private readonly secret: string;

  constructor(@Inject(CONFIG_SERVICE) config: IConfigService) {
    const svcConfig = config.getIdentitySvcConfig();
    this.secret = config.getInternalServiceSecret();
    this.http = axios.create({
      baseURL: svcConfig.url,
      timeout: svcConfig.timeoutMs,
      maxContentLength: MULTIPART_MAX_CONTENT_LENGTH,
      maxBodyLength: MULTIPART_MAX_CONTENT_LENGTH,
      // Validate only 2xx as success — anything else is mapped to a domain error.
      validateStatus: (status) => status >= 200 && status < 300,
    });
    axiosRetry(this.http, {
      retries: svcConfig.retries,
      // Exponential backoff: 100ms, 200ms, 400ms… capped by axios-retry.
      retryDelay: (retryCount, err) =>
        axiosRetry.exponentialDelay(retryCount, err),
      // Retry on network errors, idempotent timeouts, and 5xx — never on 4xx.
      retryCondition: (err) =>
        axiosRetry.isNetworkOrIdempotentRequestError(err) ||
        (err.response?.status !== undefined && err.response.status >= 500),
    });
  }

  async registerCustomer(
    input: ForwardRegisterCustomerInput,
  ): Promise<RegisterCustomerResponseDto> {
    const { correlationId, ...payload } = input;
    // Serialize the body ONCE here and pass the resulting string to axios.
    // This guarantees the SHA-256 hash is computed on the exact bytes sent over
    // the wire. Identity-svc's InternalServiceGuard re-computes the hash using:
    //   • req.rawBody (raw bytes) — if Fastify is configured with @fastify/rawbody
    //   • JSON.stringify(req.body) — fallback when rawBody is unavailable
    // Without rawBody, identity-svc parses then re-serializes. ES2015+ engines
    // maintain object key insertion order, so a JSON.parse/JSON.stringify round-trip
    // should produce an identical string for Zod-validated payloads with string
    // keys. If hash mismatches appear in production (HTTP 401 → 502), enable
    // @fastify/rawbody on identity-svc/src/main.ts to eliminate the dependency.
    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000);
    const bodySha256 = createHash('sha256').update(body).digest('hex');
    const canonical = `${timestamp}.POST.${REGISTER_CUSTOMER_PATH}.${bodySha256}`;
    const token = createHmac('sha256', this.secret)
      .update(canonical)
      .digest('hex');

    try {
      const response = await this.http.post<{
        data?: RegisterCustomerResponseDto;
      }>(REGISTER_CUSTOMER_PATH, body, {
        headers: {
          'content-type': 'application/json',
          'x-internal-service-token': token,
          'x-internal-service-timestamp': String(timestamp),
          'x-internal-service-body-sha256': bodySha256,
          'x-tukio-correlation-id': correlationId,
        },
      });
      return extractCustomerResponse(response);
    } catch (err) {
      throw mapAxiosError(err);
    }
  }

  async registerPro(
    input: ForwardRegisterProInput,
  ): Promise<RegisterProResponseDto> {
    const { correlationId, files, ...payload } = input;

    const form = new FormData();
    // Do NOT set contentType: 'application/json' on the payload field.
    // @fastify/multipart auto-parses fields whose Content-Type is JSON, which
    // would make the server-side `value` an object instead of a JSON string
    // and break the `JSON.parse(payloadJson)` step in `parse-multipart-pro-register`.
    form.append('payload', JSON.stringify(payload));
    form.append('idCard', files.idCard.buffer, {
      filename: files.idCard.originalName,
      contentType: files.idCard.contentType,
    });
    form.append('rib', files.rib.buffer, {
      filename: files.rib.originalName,
      contentType: files.rib.contentType,
    });
    if (files.kbisOrInsee) {
      form.append('kbisOrInsee', files.kbisOrInsee.buffer, {
        filename: files.kbisOrInsee.originalName,
        contentType: files.kbisOrInsee.contentType,
      });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    // Story 1.3b code-review D1 — multipart bypass on the guard side. Both ends
    // sign (and verify) against the sentinel rather than a real body hash.
    const bodySha256 = MULTIPART_BODY_HASH_SENTINEL;
    const canonical = `${timestamp}.POST.${REGISTER_PRO_PATH}.${bodySha256}`;
    const token = createHmac('sha256', this.secret)
      .update(canonical)
      .digest('hex');

    try {
      const response = await this.http.post<{
        data?: RegisterProResponseDto;
      }>(REGISTER_PRO_PATH, form.getBuffer(), {
        headers: {
          ...form.getHeaders(),
          'x-internal-service-token': token,
          'x-internal-service-timestamp': String(timestamp),
          'x-internal-service-body-sha256': bodySha256,
          'x-tukio-correlation-id': correlationId,
        },
      });
      return extractProResponse(response);
    } catch (err) {
      throw mapAxiosError(err);
    }
  }
}

function extractCustomerResponse(
  response: AxiosResponse<{ data?: RegisterCustomerResponseDto }>,
): RegisterCustomerResponseDto {
  // identity-svc wraps every success in `SuccessEnvelope { data, ... }` (ADR-014).
  const envelope = response.data;
  const data = envelope?.data;
  // P2 patch: explicitly guard null/undefined before field access — `!data` was
  // previously truthy for `null`, but `data.userId` would throw a TypeError before
  // the IdentitySvcUnreachableError could be raised.
  if (data == null) {
    throw new IdentitySvcUnreachableError(
      'identity-svc returned a null or missing data field in the envelope',
    );
  }
  if (
    typeof data.userId !== 'string' ||
    data.requiresEmailVerification !== true
  ) {
    throw new IdentitySvcUnreachableError(
      'identity-svc returned an envelope with unexpected shape',
    );
  }
  return data;
}

function extractProResponse(
  response: AxiosResponse<{ data?: RegisterProResponseDto }>,
): RegisterProResponseDto {
  const envelope = response.data;
  const data = envelope?.data;
  if (data == null) {
    throw new IdentitySvcUnreachableError(
      'identity-svc returned a null or missing data field in the envelope',
    );
  }
  if (
    typeof data.userId !== 'string' ||
    typeof data.proProfileId !== 'string' ||
    data.requiresAdminReview !== true ||
    data.requiresEmailVerification !== true
  ) {
    throw new IdentitySvcUnreachableError(
      'identity-svc returned an envelope with unexpected shape',
    );
  }
  return data;
}

function mapAxiosError(err: unknown): Error {
  if (axios.isAxiosError(err)) {
    return mapResponseToDomain(err);
  }
  if (err instanceof Error) {
    return new IdentitySvcUnreachableError(err.message, err);
  }
  return new IdentitySvcUnreachableError('Unknown identity-svc failure', err);
}

function mapResponseToDomain(err: AxiosError): Error {
  const status = err.response?.status;
  const body = (err.response?.data ?? {}) as ErrorEnvelopeBody;
  const tukioCode = body.error?.tukioCode ?? 'IDENTITY-UNKNOWN';
  const detail = body.error?.detail ?? body.error?.title ?? err.message;

  if (status === 409) {
    return new IdentitySvcConflictError(tukioCode, detail);
  }
  if (status === 422 || status === 400) {
    return new IdentitySvcValidationError(
      tukioCode,
      detail,
      body.error?.issues ?? [],
    );
  }
  // 401/403 from identity-svc means the gateway HMAC was rejected — surfaces
  // as a 502 to the public caller (server misconfig, not a client problem).
  // 5xx and network errors funnel here after retries exhausted.
  return new IdentitySvcUnreachableError(
    status
      ? `identity-svc responded ${status}: ${detail}`
      : `identity-svc unreachable: ${err.message}`,
    err,
  );
}
