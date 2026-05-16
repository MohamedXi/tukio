import { randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Inject,
  Ip,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@tukio/auth/decorators/public';
import type { AcquisitionInputDto } from '@tukio/contracts/dtos/identity/acquisition';
import { RegisterCustomerHttpDto } from '../dtos/register-customer.dto.js';
import { Cookies } from '../decorators/cookies.decorator.js';
import { mergeAcquisition } from '../utils/merge-acquisition.js';
import {
  REGISTER_CUSTOMER_FORWARDER,
  type RegisterCustomerForwarderProxy,
} from '../../usecases-proxy/usecases-proxy.module.js';

const ACQUISITION_COOKIE = 'tk_acq';

interface RegisterCustomerResponseDto {
  userId: string;
  requiresEmailVerification: true;
}

/**
 * Story 1.2c — `POST /v1/auth/customer/register`.
 *
 * Public B2C customer registration endpoint backed by identity-svc
 * `POST /internal/customers` (Story 1.2b). The gateway is responsible for :
 *
 *  - Public access (no JWT required — `@Public()` opts out of `KeycloakJwtGuard`).
 *  - Rate limiting (5 req/min/IP via `@Throttle` overriding the `default` scope).
 *  - Zod body validation (global `ZodValidationPipe` against
 *    `RegisterCustomerHttpDto`).
 *  - First-touch acquisition merge (`tk_acq` cookie wins over body).
 *  - Downstream forward signed with HMAC headers (Story 1.2b
 *    `InternalServiceGuard`) and the inbound correlation id.
 *
 * Throttling design : the module configures a single `default` scope (60/min)
 * applied to every route ; this decorator overrides it to 5/min on register to
 * match NFR10 ("sensitive" anonymous endpoints).
 */
@Controller({ path: 'auth/customer', version: '1' })
export class AuthCustomerController {
  constructor(
    @Inject(REGISTER_CUSTOMER_FORWARDER)
    private readonly forwarderProxy: RegisterCustomerForwarderProxy,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(201)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(
    @Body() dto: RegisterCustomerHttpDto,
    @Ip() _ip: string,
    @Headers('user-agent') _userAgent: string | undefined,
    @Headers('x-tukio-correlation-id') inboundCorrelationId: string | undefined,
    @Cookies(ACQUISITION_COOKIE) acquisitionCookie: string | undefined,
  ): Promise<RegisterCustomerResponseDto> {
    void _ip;
    void _userAgent;
    const correlationId = inboundCorrelationId ?? randomUUID();
    const acquisition: AcquisitionInputDto | undefined = mergeAcquisition(
      acquisitionCookie,
      dto.acquisition,
    );
    return this.forwarderProxy.getInstance().execute({
      email: dto.email,
      password: dto.password,
      firstName: dto.firstName,
      lastName: dto.lastName,
      locale: dto.locale,
      acceptTerms: dto.acceptTerms,
      acceptMarketing: dto.acceptMarketing,
      ...(acquisition ? { acquisition } : {}),
      correlationId,
    });
  }
}
