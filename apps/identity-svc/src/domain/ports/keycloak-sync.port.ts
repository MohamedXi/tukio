// Placeholder port — real implementation arrives Story 1.1 (Provision Keycloak realm).
export interface IKeycloakSync {
  syncUserFromKeycloak(keycloakUserId: string): Promise<void>;
}
