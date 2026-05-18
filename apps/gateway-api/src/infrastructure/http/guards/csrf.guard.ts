import { timingSafeEqual } from 'node:crypto';
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { AuthCsrfMismatchException } from '../../../domain/exception/auth-csrf-mismatch.exception.js';

const CSRF_HEADER = 'x-csrf-token';
const CSRF_COOKIE = 'tukio-csrf-token';

interface FastifyRequestWithCsrf {
  headers: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string | undefined>;
}

/**
 * Story 1.4b AC7 — double-submit cookie CSRF defense for state-changing
 * endpoints (POST /v1/auth/refresh + POST /v1/auth/logout).
 *
 * The frontend reads the `tukio-csrf-token` JS-readable cookie set at login
 * (Story 1.4a `buildSessionCookies`) and mirrors the value in the
 * `X-CSRF-Token` request header. Cross-origin attackers can forge the cookie
 * via CSRF, but cannot read it (SameSite=Strict + different origin) — so
 * they cannot set the matching header.
 *
 * Constant-time comparison protects against timing oracles that would
 * otherwise leak the cookie value byte by byte (NFR13).
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<FastifyRequestWithCsrf>();
    const headerValue = readHeader(req.headers[CSRF_HEADER]);
    const cookieValue = req.cookies?.[CSRF_COOKIE];

    if (!headerValue || !cookieValue) {
      throw new AuthCsrfMismatchException('CSRF header or cookie missing');
    }

    if (!safeEqual(headerValue, cookieValue)) {
      throw new AuthCsrfMismatchException('CSRF header does not match cookie');
    }

    return true;
  }
}

function readHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    // timingSafeEqual would throw on length mismatch; the very fact that the
    // attacker is probing for length already leaks one bit, so this fail-fast
    // is acceptable (and consistent with the broader OWASP guidance).
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
