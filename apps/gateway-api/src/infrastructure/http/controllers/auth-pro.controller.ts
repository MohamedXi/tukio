import { randomUUID } from 'node:crypto';
import {
  Controller,
  Headers,
  HttpCode,
  Inject,
  Post,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@tukio/auth/decorators/public';
import { Cookies } from '../decorators/cookies.decorator.js';
import { mergeAcquisition } from '../utils/merge-acquisition.js';
import { parseMultipartProRegister } from '../utils/parse-multipart-pro-register.js';
import {
  REGISTER_PRO_FORWARDER,
  type RegisterProForwarderProxy,
} from '../../usecases-proxy/usecases-proxy.module.js';
import type { RegisterProResponseDto } from '@tukio/contracts/dtos/identity/register-pro';

const ACQUISITION_COOKIE = 'tk_acq';

// Structural request shape — avoids declaring `fastify` as a direct dep of
// gateway-api (it arrives transitively via @nestjs/platform-fastify and
// @fastify/multipart). Must be structurally compatible with the
// MultipartRequest interface expected by `parseMultipartProRegister`.
interface MultipartHttpRequest {
  isMultipart: () => boolean;
  parts: (options?: {
    limits?: { fileSize?: number };
  }) => AsyncIterableIterator<unknown>;
}

/**
 * Story 1.3c — `POST /v1/auth/pro/register`.
 *
 * Public B2B pro registration endpoint backed by identity-svc
 * `POST /internal/pros` (Story 1.3b). The gateway is responsible for :
 *
 *  - Public access (no JWT required — `@Public()` opts out of `KeycloakJwtGuard`).
 *  - Rate limiting (3 req/min/IP via `@Throttle` overriding the `default` scope —
 *    tighter than customer register (5/min) because pro KYC is more sensitive).
 *  - Multipart parsing : `payload` JSON field + 3 file fields (idCard required,
 *    rib required, kbisOrInsee optional) with MIME whitelist and 5 MB/file cap.
 *  - First-touch acquisition merge (`tk_acq` cookie wins over body).
 *  - Downstream multipart forward with HMAC headers (Story 1.2b
 *    `InternalServiceGuard`, sentinel body-hash per Story 1.3b D1) and the
 *    inbound correlation id.
 */
@Controller({ path: 'auth/pro', version: '1' })
export class AuthProController {
  constructor(
    @Inject(REGISTER_PRO_FORWARDER)
    private readonly forwarderProxy: RegisterProForwarderProxy,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(201)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async register(
    @Req() req: MultipartHttpRequest,
    @Headers('x-tukio-correlation-id') inboundCorrelationId: string | undefined,
    @Cookies(ACQUISITION_COOKIE) acquisitionCookie: string | undefined,
  ): Promise<RegisterProResponseDto> {
    const { payload, files } = await parseMultipartProRegister(req);
    const correlationId = inboundCorrelationId ?? randomUUID();
    const { acquisition: bodyAcquisition, ...rest } = payload;
    const acquisition = mergeAcquisition(acquisitionCookie, bodyAcquisition);

    return this.forwarderProxy.getInstance().execute({
      ...rest,
      ...(acquisition ? { acquisition } : {}),
      files,
      correlationId,
    });
  }
}
