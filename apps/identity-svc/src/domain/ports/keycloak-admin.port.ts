import type { Locale } from '@tukio/contracts/types/Locale';
import type { UserStatus } from '../model/user-status.enum.js';
import type { UserRole } from '../model/user-role.enum.js';

/**
 * Domain-level error types thrown by `IKeycloakAdmin` implementations.
 * Infrastructure adapters (Story 1.2b `@keycloak/keycloak-admin-client` wrapper)
 * translate library-specific errors to these — keeps the use case Pretre-pure
 * (no import from infrastructure).
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
