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
    // Fastify reply (`code(...).send(...)`) vs Express response (`status(...).json(...)`).
    const response = ctx.getResponse<{
      status?: (code: number) => unknown;
      code?: (code: number) => unknown;
      json?: (body: unknown) => unknown;
      send?: (body: unknown) => unknown;
    }>();

    const method = extractMethod(request);
    const instance = extractUrl(request);
    const meta = buildMeta(request);

    const { httpStatus, body } = this.toErrorBody(exception, instance);

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
  ): { httpStatus: number; body: ErrorBody } {
    // Handles every DomainException (identity-svc + @tukio/auth share the
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

    if (exception instanceof ZodError) {
      const issues: ValidationIssue[] = exception.issues.map((issue) => ({
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
