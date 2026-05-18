import type { BackendActor } from '@tukio/auth/types';
import type { WhoamiResponseDto } from '@tukio/contracts/dtos/identity/whoami-response';

const STATUS_FALLBACK: WhoamiResponseDto['status'] = 'active';

export interface WhoamiInput {
  actor: BackendActor;
  status?: WhoamiResponseDto['status'];
  mfaEnabled?: boolean;
}

/**
 * Story 1.4b AC5 — `GET /v1/auth/whoami` use case.
 *
 * Pure projection from the authenticated `BackendActor` (already validated by
 * `KeycloakJwtGuard`) to the public `WhoamiResponseDto`. No Keycloak Admin
 * round-trip — JWT is the single source of truth for the MVP. Story 1.10 will
 * reconcile with identity-svc if drift is observed in practice.
 */
export class WhoamiUseCase {
  execute(input: WhoamiInput): WhoamiResponseDto {
    const actor = input.actor;
    const status: WhoamiResponseDto['status'] =
      input.status ??
      (actor.emailVerified ? STATUS_FALLBACK : 'pending_email_verification');
    const mfaEnabled =
      input.mfaEnabled ??
      (Array.isArray(actor.amr) &&
        actor.amr.some((m: string) => m === 'totp' || m === 'webauthn'));
    return {
      userId: actor.userId,
      email: actor.email,
      role: actor.roles.length > 0 ? actor.roles : [actor.role],
      status,
      locale: actor.locale,
      emailVerified: actor.emailVerified,
      mfaEnabled,
    };
  }
}
