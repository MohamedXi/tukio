import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { AuthForbiddenException } from '@tukio/auth/exceptions';
import type { IConfigService } from '../../../domain/ports/config.port.js';
import { CONFIG_SERVICE } from '../../../domain/ports/tokens.js';

// Minimal request shape — avoids declaring `fastify` as a direct dep of
// identity-svc (it transitively comes via @nestjs/platform-fastify in main.ts
// but isn't in identity-svc's package.json). Using a structural type keeps
// the guard testable with a plain object stub.
interface MinimalHttpRequest {
  headers: Record<string, string | string[] | undefined>;
  method: string;
  url: string;
  /** Fastify exposes the parsed JSON body on `request.body`. */
  body?: unknown;
  /** Fastify exposes the raw request body buffer on `request.rawBody` when configured. */
  rawBody?: Buffer | string;
}

const HEADER_NAME = 'x-internal-service-token';
const HEADER_TIMESTAMP = 'x-internal-service-timestamp';
const HEADER_BODY_HASH = 'x-internal-service-body-sha256';
const HEADER_CONTENT_TYPE = 'content-type';
const MAX_CLOCK_SKEW_SECONDS = 300; // 5 minutes — protects against replay.
/** Sentinel for the maximum plausible Unix-seconds value (year 2286). */
const MAX_UNIX_SECONDS = 9_999_999_999;
const HEX_REGEX = /^[0-9a-f]+$/i;

/**
 * Sentinel body-hash for multipart/form-data requests (Story 1.3b code-review D1).
 *
 * Fastify does NOT populate `request.body` or `request.rawBody` for multipart
 * because parsing is opt-in via `req.parts()` at controller time — AFTER the
 * guard runs. So the guard cannot compute the actual body hash. Both sides
 * (gateway-api signing + identity-svc verifying) use this fixed sentinel
 * instead, keeping the HMAC signature bound to (timestamp, method, path) but
 * NOT to the body bytes.
 *
 * Trade-off: within the 5-minute replay window, an attacker with internal
 * network access could re-send a captured (token, ts, sig) triple with a
 * modified multipart body. Accepted for MVP given:
 *   - identity-svc:4001 is internal-only (DO firewall + K8s NetworkPolicy)
 *   - gateway-api → identity-svc traffic stays on the tukio-apps bridge network
 *   - V1+ supersedes the HMAC guard with mTLS via Linkerd (see customer.controller.ts)
 */
export const MULTIPART_BODY_HASH_SENTINEL = createHash('sha256')
  .update('TUKIO_MULTIPART_NO_BODY_HASH')
  .digest('hex');

/**
 * Story 1.2b — guards `/internal/*` endpoints with an HMAC-SHA256 signature
 * over a canonical string : `<timestamp>.<METHOD>.<path>.<body-sha256>`. The
 * body hash binding (review patch B1 from 1.2b code-review) defeats a 5-minute
 * replay window where an attacker captures a single signed (token, timestamp)
 * pair and replays it with a different body. The caller (gateway-api,
 * Story 1.2c) must compute the same canonical and pass the body hash via
 * `X-Internal-Service-Body-Sha256` header.
 *
 * V1+ : superseded by mTLS via K8s NetworkPolicy + Linkerd service mesh.
 *
 * Why HMAC + timestamp + body hash (not just shared bearer) :
 *   - HMAC binds the token to the specific request (method + path).
 *   - Body hash binds the token to the request payload — replay with a
 *     different body fails signature verification.
 *   - Timestamp + ±5min window prevents replay even if a token leaks transiently.
 *   - `timingSafeEqual` defeats timing attacks on the comparison.
 */
@Injectable()
export class InternalServiceGuard implements CanActivate {
  constructor(
    @Inject(CONFIG_SERVICE) private readonly config: IConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<MinimalHttpRequest>();
    const providedToken = headerString(request, HEADER_NAME);
    const providedTimestamp = headerString(request, HEADER_TIMESTAMP);
    const providedBodyHash = headerString(request, HEADER_BODY_HASH);

    if (!providedToken || !providedTimestamp || !providedBodyHash) {
      throw forbidden('Missing internal service authentication headers');
    }

    // Review patch E9 (1.2b) — fail fast on non-hex token so the timing-safe
    // path doesn't have to fall through Buffer.from('zz', 'hex')'s silent
    // truncation behavior (which produces an empty buffer → length-mismatch
    // 403 with a misleading "Invalid internal service token" reason).
    if (!HEX_REGEX.test(providedToken)) {
      throw forbidden('Invalid internal service token format');
    }
    if (!HEX_REGEX.test(providedBodyHash)) {
      throw forbidden('Invalid internal service body hash format');
    }

    const timestampSeconds = parseInt(providedTimestamp, 10);
    if (Number.isNaN(timestampSeconds)) {
      throw forbidden('Invalid X-Internal-Service-Timestamp header');
    }
    // Review patch E8 (1.2b) — reject obvious millisecond timestamps so the
    // caller gets a diagnostic reason instead of an opaque "out of window".
    if (timestampSeconds > MAX_UNIX_SECONDS) {
      throw forbidden(
        'X-Internal-Service-Timestamp must be Unix seconds, not milliseconds',
      );
    }
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - timestampSeconds) > MAX_CLOCK_SKEW_SECONDS) {
      throw forbidden('Internal service request timestamp out of window');
    }

    // Review patch E10 (1.2b) — normalize the path before signing :
    //   - strip query string
    //   - strip trailing slashes
    //   - guarantee a leading slash
    // Both sides MUST apply the same normalization (gateway-api Story 1.2c).
    const method = request.method.toUpperCase();
    const path = normalizePath(request.url);
    const canonical = `${providedTimestamp}.${method}.${path}.${providedBodyHash}`;

    const secret = this.config.getInternalServiceSecret();
    const expectedToken = createHmac('sha256', secret)
      .update(canonical)
      .digest('hex');

    const providedBuffer = Buffer.from(providedToken, 'hex');
    const expectedBuffer = Buffer.from(expectedToken, 'hex');
    if (providedBuffer.length !== expectedBuffer.length) {
      throw forbidden('Invalid internal service token');
    }
    if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
      throw forbidden('Invalid internal service token');
    }

    // Story 1.3b code-review D1 — multipart bypass: Fastify cannot expose the
    // raw multipart body to the guard (parsing is opt-in at controller time).
    // The gateway-api signs and sends the fixed MULTIPART_BODY_HASH_SENTINEL
    // for multipart endpoints; the canonical above already includes it, so
    // the token check above already validated the (ts, method, path, sentinel)
    // tuple. Skip the body-hash recomputation only when both the Content-Type
    // is multipart AND the claimed hash is exactly the sentinel.
    const contentType = (
      headerString(request, HEADER_CONTENT_TYPE) ?? ''
    ).toLowerCase();
    const isMultipart = contentType.startsWith('multipart/');
    if (isMultipart) {
      if (providedBodyHash.toLowerCase() !== MULTIPART_BODY_HASH_SENTINEL) {
        throw forbidden(
          'Multipart requests must use the multipart body-hash sentinel',
        );
      }
      return true;
    }

    // Review patch B1 (1.2b) — verify the body hash actually matches the
    // received payload. Without this, an attacker who learned the (token,
    // timestamp, claimed-body-hash) triple could replay it with any body
    // the caller pre-claimed. We recompute on receive and compare with
    // the claimed hash.
    const actualBodyHash = computeBodySha256(request);
    const actualBuffer = Buffer.from(actualBodyHash, 'hex');
    const claimedBodyBuffer = Buffer.from(
      providedBodyHash.toLowerCase(),
      'hex',
    );
    if (actualBuffer.length !== claimedBodyBuffer.length) {
      throw forbidden('Body hash length mismatch');
    }
    if (!timingSafeEqual(actualBuffer, claimedBodyBuffer)) {
      throw forbidden('Body hash mismatch — payload was modified in transit');
    }

    return true;
  }
}

function headerString(
  req: MinimalHttpRequest,
  name: string,
): string | undefined {
  const raw = req.headers[name];
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

function normalizePath(url: string): string {
  const beforeQuery = url.split('?')[0] ?? '';
  const stripped = beforeQuery.replace(/\/+$/u, '');
  return stripped.length === 0 ? '/' : stripped;
}

function computeBodySha256(req: MinimalHttpRequest): string {
  // Prefer the raw buffer when available (Fastify can expose it). Otherwise
  // canonicalize the parsed body via stable JSON serialization. For requests
  // without a body (GET, DELETE), hash the empty string.
  if (req.rawBody !== undefined) {
    const buf =
      typeof req.rawBody === 'string' ? Buffer.from(req.rawBody) : req.rawBody;
    return createHash('sha256').update(buf).digest('hex');
  }
  if (req.body === undefined || req.body === null) {
    return createHash('sha256').update('').digest('hex');
  }
  const serialized =
    typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  return createHash('sha256').update(serialized).digest('hex');
}

function forbidden(detail: string): AuthForbiddenException {
  // AUTH-FORBIDDEN-002 is reserved for internal-service auth failures
  // (`AuthErrorCodes.FORBIDDEN_INTERNAL` in @tukio/contracts/types/error-codes).
  // Today @tukio/auth only exposes AUTH-FORBIDDEN-001 via AuthForbiddenException;
  // promoting to a dedicated subclass is out of scope for 1.2b.
  return new AuthForbiddenException(detail);
}
