import { createHash, createHmac } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosResponse,
} from 'axios';
import axiosRetry from 'axios-retry';
import type {
  ForwardRegisterCustomerInput,
  IIdentitySvcClient,
} from '../../../domain/ports/identity-svc.port.js';
import type { IConfigService } from '../../../domain/ports/config.port.js';
import { CONFIG_SERVICE } from '../../../domain/ports/tokens.js';
import type { RegisterCustomerResponseDto } from '@tukio/contracts/dtos/identity/register-customer';
import type { ValidationIssue } from '@tukio/contracts/envelope';
import {
  IdentitySvcConflictError,
  IdentitySvcUnreachableError,
  IdentitySvcValidationError,
} from '../../../domain/ports/identity-svc.errors.js';

/**
 * Path on identity-svc that handles `POST /internal/customers` (Story 1.2b).
 * Both gateway-api and identity-svc use Nest URI versioning (`/v1/...`),
 * so the actual exposed route is `/v1/internal/customers`.
 */
const REGISTER_CUSTOMER_PATH = '/v1/internal/customers';

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
      return extractRegisterResponse(response);
    } catch (err) {
      throw mapAxiosError(err);
    }
  }
}

function extractRegisterResponse(
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
