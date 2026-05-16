import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ZodError } from 'zod';
import type {
  ErrorBody,
  ErrorEnvelope,
  ValidationIssue,
} from '@tukio/contracts/envelope';
import { DomainException } from '../../../domain/exception/domain.exception.js';
import { ValidationFailedException } from '../../../domain/exception/validation-failed.exception.js';
import {
  buildMeta,
  extractMethod,
  extractUrl,
  type RequestLike,
} from '../envelope/envelope.helpers.js';

const PII_REDACT_PATTERNS: ReadonlyArray<RegExp> = [
  // emails
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi,
  // French phone numbers — requires leading +33 / 0033 / 0[1-9] to avoid matching
  // port numbers, error codes, and other numeric sequences in error messages.
  /(?:\+33|0033|0)[1-9](?:[\s.-]?\d{2}){4}/g,
];

const ERROR_TYPE_BASE = 'https://tukio.one/errors';
// Use a numeric literal here to dodge `no-unsafe-enum-comparison` between
// `exception.getStatus(): number` and the `HttpStatus` enum.
const HTTP_TOO_MANY_REQUESTS = 429;

interface ResponseAdapter {
  status?: (code: number) => unknown;
  code?: (code: number) => unknown;
  json?: (body: unknown) => unknown;
  send?: (body: unknown) => unknown;
  header?: (name: string, value: string | number) => unknown;
  setHeader?: (name: string, value: string | number) => unknown;
  getHeader?: (name: string) => string | number | string[] | undefined;
}

const slugify = (raw: string): string =>
  raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';

const redactPii = (value: string): string => {
  let out = value;
  for (const pattern of PII_REDACT_PATTERNS) {
    out = out.replace(pattern, '***');
  }
  return out;
};

@Catch()
export class EnvelopeExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<RequestLike>();
    const response = ctx.getResponse<ResponseAdapter>();

    const method = extractMethod(request);
    const instance = extractUrl(request);
    const meta = buildMeta(request);

    const { httpStatus, body } = this.toErrorBody(
      exception,
      instance,
      response,
    );

    const envelope: ErrorEnvelope = {
      method,
      code: httpStatus,
      error: body,
      meta,
    };

    // Choose the right adapter (Fastify or Express).
    if (
      typeof response.code === 'function' &&
      typeof response.send === 'function'
    ) {
      response.code(httpStatus);
      response.send(envelope);
      return;
    }
    if (
      typeof response.status === 'function' &&
      typeof response.json === 'function'
    ) {
      response.status(httpStatus);
      response.json(envelope);
      return;
    }
    // Last resort — should never happen under Nest's HTTP adapters.
    throw new Error(
      'EnvelopeExceptionFilter: unsupported HTTP response adapter',
    );
  }

  private toErrorBody(
    exception: unknown,
    instance: string,
    response: ResponseAdapter,
  ): { httpStatus: number; body: ErrorBody } {
    // ValidationFailedException is a DomainException sub-class that carries
    // `issues[]`. Handle it first so the issues array survives the trip.
    if (exception instanceof ValidationFailedException) {
      return {
        httpStatus: exception.httpStatus,
        body: {
          type: `${ERROR_TYPE_BASE}/validation-failed`,
          title: exception.title,
          detail: redactPii(exception.message),
          instance,
          tukioCode: exception.tukioCode,
          issues: exception.issues,
        },
      };
    }

    // Handles every DomainException (gateway-api + @tukio/auth share the
    // same base from @tukio/contracts).
    if (exception instanceof DomainException) {
      return {
        httpStatus: exception.httpStatus,
        body: {
          type: `${ERROR_TYPE_BASE}/${slugify(exception.tukioCode)}`,
          title: exception.title,
          detail: redactPii(exception.message),
          instance,
          tukioCode: exception.tukioCode,
        },
      };
    }

    // Either a raw ZodError (when something throws one directly) or a
    // `ZodValidationException` from `nestjs-zod` (a BadRequestException that
    // wraps the ZodError and exposes it via `getZodError()`). Both surface as
    // 422 VALIDATION-FAILED-001 with the canonical issues[] array.
    const zodError = asZodError(exception);
    if (zodError) {
      const issues: ValidationIssue[] = zodError.issues.map((issue) => ({
        path: issue.path.map((segment) => String(segment)).join('.'),
        code: issue.code,
        message: issue.message,
      }));
      return {
        httpStatus: HttpStatus.UNPROCESSABLE_ENTITY,
        body: {
          type: `${ERROR_TYPE_BASE}/validation-failed`,
          title: 'Validation failed',
          detail: 'Request payload failed validation.',
          instance,
          tukioCode: 'VALIDATION-FAILED-001',
          issues,
        },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      // 429 Too Many Requests — emitted by `@nestjs/throttler` ThrottlerGuard
      // (Story 1.2c). The guard already set `Retry-After` on the response;
      // mirror it inside the body so clients that read JSON have it too.
      if (status === HTTP_TOO_MANY_REQUESTS) {
        const retryAfter = readRetryAfter(response);
        return {
          httpStatus: status,
          body: {
            type: `${ERROR_TYPE_BASE}/rate-limit-exceeded`,
            title: 'Too Many Requests',
            detail:
              'Rate limit exceeded — try again after the Retry-After delay.',
            instance,
            tukioCode: 'RATE-LIMIT-EXCEEDED-001',
            ...(retryAfter !== undefined ? { retryAfter } : {}),
          },
        };
      }
      const responseBody = exception.getResponse();
      const detail =
        typeof responseBody === 'string'
          ? responseBody
          : ((responseBody as { message?: string }).message ??
            exception.message);
      return {
        httpStatus: status,
        body: {
          type: `${ERROR_TYPE_BASE}/http-${status}`,
          title: HttpStatus[status] ?? 'Error',
          detail: redactPii(detail),
          instance,
          tukioCode: `HTTP-${status}-001`,
        },
      };
    }

    // Fallback — never leak unexpected error messages with PII.
    return {
      httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        type: `${ERROR_TYPE_BASE}/internal-server-error`,
        title: 'Internal server error',
        detail: 'An unexpected error occurred.',
        instance,
        tukioCode: 'INTERNAL-SERVER-ERROR-001',
      },
    };
  }
}

function asZodError(exception: unknown): ZodError | undefined {
  if (exception instanceof ZodError) return exception;
  // Duck-typed match for `nestjs-zod`'s ZodValidationException — keep the
  // filter agnostic of the nestjs-zod import so the error class doesn't have
  // to leak into the gateway-api bundle when unused.
  if (
    exception &&
    typeof exception === 'object' &&
    'getZodError' in exception &&
    typeof exception.getZodError === 'function'
  ) {
    try {
      const inner = (exception as { getZodError: () => unknown }).getZodError();
      if (inner instanceof ZodError) return inner;
    } catch {
      // fall through
    }
  }
  return undefined;
}

function readRetryAfter(response: ResponseAdapter): number | undefined {
  // Fastify reply exposes `getHeader`; Express `response.getHeader` exists too.
  if (typeof response.getHeader !== 'function') return undefined;
  const raw =
    response.getHeader('retry-after') ?? response.getHeader('Retry-After');
  if (raw === undefined) return undefined;
  // P5 patch: Express may return multi-valued headers as string[]. Take the first
  // element; Fastify returns a single string/number.
  const scalar = Array.isArray(raw) ? raw[0] : raw;
  if (scalar === undefined) return undefined;
  const n = Number(scalar);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
