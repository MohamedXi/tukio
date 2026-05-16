import type {
  RegisterCustomerInputDto,
  RegisterCustomerResponseDto,
} from '@tukio/contracts/dtos/identity/register-customer';

/**
 * Domain port for the identity-svc HTTP client (Story 1.2c). Gateway-api is a
 * BFF — it owns no aggregates, so the only "domain" it knows is the downstream
 * service contract. Concrete impl lives in
 * `infrastructure/external/identity-svc/identity-svc.client.ts`.
 */
export interface IIdentitySvcClient {
  /**
   * Forward a customer registration to identity-svc `POST /internal/customers`.
   * The implementation MUST :
   *   - sign the request with HMAC over `${ts}.POST.${path}.${bodySha256}`,
   *   - pass `X-Internal-Service-Token`, `-Timestamp`, `-Body-Sha256` headers,
   *   - propagate the inbound correlation id via `X-Tukio-Correlation-Id`,
   *   - retry transient 5xx / network errors with exponential backoff,
   *   - throw `IdentitySvcConflictError` on HTTP 409,
   *           `IdentitySvcValidationError` on HTTP 422,
   *           `IdentitySvcUnreachableError` on network / 5xx exhausted.
   */
  registerCustomer(
    input: ForwardRegisterCustomerInput,
  ): Promise<RegisterCustomerResponseDto>;
}

export interface ForwardRegisterCustomerInput extends RegisterCustomerInputDto {
  /** Inbound `X-Tukio-Correlation-Id` (or freshly minted by gateway-api). */
  correlationId: string;
}
