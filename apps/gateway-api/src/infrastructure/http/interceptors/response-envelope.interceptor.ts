import {
  type CallHandler,
  type ExecutionContext,
  HttpException,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { type Observable, map } from 'rxjs';
import type { Pagination, SuccessEnvelope } from '@tukio/contracts/envelope';
import {
  buildMeta,
  extractMethod,
  type RequestLike,
} from '../envelope/envelope.helpers.js';

interface PaginatedPayload<T> {
  data: T[];
  pagination: Pagination;
}

const isPaginatedPayload = <T>(
  value: unknown,
): value is PaginatedPayload<T> => {
  if (!value || typeof value !== 'object') return false;
  const v = value as { data?: unknown; pagination?: unknown };
  return (
    Array.isArray(v.data) &&
    typeof v.pagination === 'object' &&
    v.pagination !== null
  );
};

// ADR-014 — wrap every successful response in SuccessEnvelope.
// Controllers return raw DTOs; this interceptor handles envelope wrapping globally.
@Injectable()
export class ResponseEnvelopeInterceptor<T> implements NestInterceptor<
  T,
  SuccessEnvelope<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<SuccessEnvelope<T>> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<RequestLike>();
    const response = httpContext.getResponse<{ statusCode?: number }>();

    return next.handle().pipe(
      map((payload) => {
        const code = response.statusCode ?? 200;
        const method = extractMethod(request);
        const meta = buildMeta(request);

        if (payload === undefined || payload === null) {
          return { method, code, data: null, meta };
        }

        if (isPaginatedPayload<T>(payload)) {
          return {
            method,
            code,
            data: payload.data,
            pagination: payload.pagination,
            meta,
          };
        }

        if (Array.isArray(payload)) {
          return { method, code, data: payload as T[], meta };
        }

        return { method, code, data: payload, meta };
      }),
    );
  }
}

// Re-export so HttpException class can be imported alongside the interceptor without
// pulling NestJS into the domain layer.
export { HttpException };
