import { randomUUID } from 'node:crypto';
import type {
  EnvelopeMethod,
  Meta,
  Pagination,
} from '@tukio/contracts/envelope';

export type RequestLike = {
  method?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
  // Set by the gateway/correlation middleware (Story 0.7) — fall back to a fresh uuid.
  correlationId?: string;
} & {
  raw?: {
    method?: string;
    url?: string;
    headers?: Record<string, string | string[] | undefined>;
  };
};

export const SERVICE_NAME = 'identity-svc';

const ALLOWED_METHODS: ReadonlyArray<EnvelopeMethod> = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
];

export function asEnvelopeMethod(method: string | undefined): EnvelopeMethod {
  const upper = (method ?? 'GET').toUpperCase();
  return (ALLOWED_METHODS as readonly string[]).includes(upper)
    ? (upper as EnvelopeMethod)
    : 'GET';
}

export function pickHeader(
  headers: Record<string, string | string[] | undefined> | undefined,
  name: string,
): string | undefined {
  if (!headers) return undefined;
  const raw = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

export function buildMeta(req: RequestLike | undefined): Meta {
  const headers = req?.headers ?? req?.raw?.headers;
  const localeHeader = pickHeader(headers, 'X-Tukio-Locale')?.toLowerCase();
  const locale: 'fr' | 'en' = localeHeader === 'en' ? 'en' : 'fr';
  const correlationId =
    req?.correlationId ??
    pickHeader(headers, 'X-Correlation-Id') ??
    randomUUID();
  const requestId = pickHeader(headers, 'X-Request-Id');
  return {
    timestamp: new Date().toISOString(),
    correlationId,
    locale,
    ...(requestId ? { requestId } : {}),
  };
}

export function extractMethod(req: RequestLike | undefined): EnvelopeMethod {
  return asEnvelopeMethod(req?.method ?? req?.raw?.method);
}

export function extractUrl(req: RequestLike | undefined): string {
  return req?.url ?? req?.raw?.url ?? '';
}

export type DataOrCollection<T> = T | T[] | null;

export interface PaginationCarrier {
  pagination?: Pagination;
}
