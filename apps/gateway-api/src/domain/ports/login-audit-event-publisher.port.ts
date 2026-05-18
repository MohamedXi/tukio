import type { UserLoggedInV1Payload } from '@tukio/contracts/events/identity/user-logged-in.v1';

/**
 * Port — fire-and-forget audit publisher for `identity.user.logged-in.v1`
 * (Story 1.4b AC2). Gateway-api MVP does NOT use the transactional outbox here
 * since the event is non-critical audit telemetry — losing one on a NATS
 * outage is acceptable and the callback HTTP response MUST succeed regardless.
 *
 * Real implementation wires to `@tukio/messaging/nats/client`; see
 * `infrastructure/external/login-audit/`.
 */
export interface ILoginAuditEventPublisher {
  publishLoggedIn(payload: UserLoggedInV1Payload): Promise<void>;
}
