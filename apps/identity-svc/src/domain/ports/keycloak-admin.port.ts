import type { Locale } from '@tukio/contracts/types/Locale';
import type { UserStatus } from '../model/user-status.enum.js';
import type { UserRole } from '../model/user-role.enum.js';

/**
 * Domain-level error types thrown by `IKeycloakAdmin` implementations.
 * Infrastructure adapters (Story 1.2b `@keycloak/keycloak-admin-client` wrapper)
 * translate library-specific errors to these — keeps the use case Pretre-pure
 * (no import from infrastructure).
 *
 * Note: `findUserById` returns `null` for not-found instead of throwing — the
 * convert-customer-to-pro use case maps the null to an `IdentityValidationException`
 * with `NOT_FOUND_USER`. No dedicated `KeycloakUserNotFoundError` class needed.
 */
export class KeycloakUserAlreadyExistsError extends Error {
  constructor(email: string) {
    super(`Keycloak user already exists for email "${email}"`);
    this.name = 'KeycloakUserAlreadyExistsError';
    Object.setPrototypeOf(this, KeycloakUserAlreadyExistsError.prototype);
  }
}

export class KeycloakUnreachableError extends Error {
  readonly underlyingError?: unknown;
  constructor(message: string, underlyingError?: unknown) {
    super(message);
    this.name = 'KeycloakUnreachableError';
    this.underlyingError = underlyingError;
    Object.setPrototypeOf(this, KeycloakUnreachableError.prototype);
  }
}

/**
 * Port — Keycloak Admin API client (Pattern Pretre).
 * Real implementation arrives Story 1.2b via `@keycloak/keycloak-admin-client`.
 * Domain layer never imports the concrete library.
 */
/**
 * Minimal Keycloak user representation returned by `findUserById`.
 * Domain layer only needs what is required to validate conversion eligibility
 * and to merge existing custom attributes before calling `setUserAttributes`.
 */
export interface KeycloakUserProfile {
  keycloakUserId: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  email: string;
  /** Existing custom attributes on the Keycloak user (e.g. `tukio:locale`). */
  attributes: Record<string, string[]>;
}

export interface CreateKeycloakUserInput {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  locale: Locale;
  emailVerified: boolean;
  role: UserRole;
  status: UserStatus;
}

export interface CreateKeycloakUserResult {
  keycloakUserId: string;
}

export interface IKeycloakAdmin {
  createUser(input: CreateKeycloakUserInput): Promise<CreateKeycloakUserResult>;
  findUserByEmail(email: string): Promise<{ keycloakUserId: string } | null>;
  /**
   * Fetch a single user by their Keycloak UUID (the JWT `sub` claim).
   * Used by `ConvertCustomerToProUseCase` (Story 1.3b-bis) to verify the
   * account exists and its email is verified before starting the conversion.
   * Returns `null` if the user is not found.
   */
  findUserById(keycloakUserId: string): Promise<KeycloakUserProfile | null>;
  /**
   * Check whether a user holds a given realm-level role.
   * Used by `ConvertCustomerToProUseCase` to reject already-converted accounts.
   */
  hasRealmRole(keycloakUserId: string, role: UserRole): Promise<boolean>;
  /**
   * Hard-delete used only for compensation rollback when the business DB transaction
   * fails after the Keycloak user has been created (Story 1.2 §"Compensation pattern").
   * Normal account closure uses soft-delete + anonymization (Story 1.9).
   */
  deleteUser(keycloakUserId: string): Promise<void>;
  setUserPassword(
    keycloakUserId: string,
    password: string,
    temporary: boolean,
  ): Promise<void>;
  assignRealmRole(keycloakUserId: string, role: UserRole): Promise<void>;
  setUserAttributes(
    keycloakUserId: string,
    attributes: Record<string, readonly string[]>,
  ): Promise<void>;
}
