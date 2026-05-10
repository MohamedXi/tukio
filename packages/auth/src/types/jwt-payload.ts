export interface KeycloakJwtPayload {
  sub: string;
  iss: string;
  aud: string | string[];
  exp: number;
  iat: number;
  jti?: string;
  email?: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
  locale?: string;
  amr?: string[];
  realm_access?: {
    roles: string[];
  };
  resource_access?: Record<string, { roles: string[] }>;
}
