import type {
  RegisterCustomerInputDto,
  RegisterCustomerResponseDto,
} from '@tukio/contracts/dtos/identity/register-customer';
import type {
  RegisterProInputDto,
  RegisterProResponseDto,
} from '@tukio/contracts/dtos/identity/register-pro';

/**
 * Domain port for the identity-svc HTTP client (Story 1.2c + 1.3c). Gateway-api
 * is a BFF — it owns no aggregates, so the only "domain" it knows is the
 * downstream service contract. Concrete impl lives in
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

  /**
   * Forward a pro registration to identity-svc `POST /internal/pros`
   * (Story 1.3c). The request is multipart/form-data with:
   *   - `payload` field: JSON-stringified `RegisterProInputDto`
   *   - `idCard`, `rib`, `kbisOrInsee?` file fields (JPEG/PNG/PDF, ≤ 5 MB each)
   *
   * Because Fastify cannot expose the raw multipart body to the
   * `InternalServiceGuard` (parsing is opt-in at controller time, AFTER the
   * guard runs), the implementation MUST sign with
   * `MULTIPART_BODY_HASH_SENTINEL` instead of the real body hash. The guard
   * recognises the sentinel and skips the body-hash recomputation step
   * (see identity-svc Story 1.3b code-review D1). Error mapping rules are
   * identical to `registerCustomer`.
   */
  registerPro(input: ForwardRegisterProInput): Promise<RegisterProResponseDto>;
}

export interface ForwardRegisterCustomerInput extends RegisterCustomerInputDto {
  /** Inbound `X-Tukio-Correlation-Id` (or freshly minted by gateway-api). */
  correlationId: string;
}

/** KYC file forwarded as a multipart part. */
export interface RegisterProForwardedFile {
  buffer: Buffer;
  contentType: string;
  originalName: string;
}

export interface ForwardRegisterProInput extends RegisterProInputDto {
  /** Keycloak user id (JWT `sub`) — injected by gateway-api from the authenticated actor. */
  userId: string;
  /** Inbound `X-Tukio-Correlation-Id` (or freshly minted by gateway-api). */
  correlationId: string;
  files: {
    idCard: RegisterProForwardedFile;
    rib: RegisterProForwardedFile;
    kbisOrInsee?: RegisterProForwardedFile;
  };
}
