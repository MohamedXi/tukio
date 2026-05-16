/**
 * E2E test user helpers — Story 1.2d (AC7).
 *
 * Creates and cleans up test users via Keycloak Admin API directly (faster than
 * going through the gateway) so Playwright tests can set up preconditions
 * deterministically without gateway-api throttle interference.
 *
 * Requires the services to be running: `pnpm docker:up:wait && pnpm dev`
 */

import type { Page } from '@playwright/test';

const KEYCLOAK_URL = process.env.KEYCLOAK_URL ?? 'http://localhost:8080';
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM ?? 'tukio';
const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID ?? 'tukio-api';

function readClientSecret(): string {
  const secret = process.env.KEYCLOAK_CLIENT_SECRET_TUKIO_API;
  if (!secret) {
    throw new Error(
      'KEYCLOAK_CLIENT_SECRET_TUKIO_API is required for E2E test-user helpers. ' +
        'Source it from your local .env or CI secret store before running Playwright.',
    );
  }
  return secret;
}

async function getAdminToken(): Promise<string> {
  const res = await fetch(
    `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: KEYCLOAK_CLIENT_ID,
        client_secret: readClientSecret(),
      }),
    },
  );
  if (!res.ok) throw new Error(`Failed to get admin token: ${res.status} ${res.statusText}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

interface RealmRoleRep {
  id: string;
  name: string;
  composite?: boolean;
  clientRole?: boolean;
  containerId?: string;
}

async function assignRealmRole(token: string, userId: string, roleName: string): Promise<void> {
  // Keycloak Admin POST /users ignores the `realmRoles` body field; role
  // mapping requires a follow-up POST to /users/{id}/role-mappings/realm with
  // the full RoleRepresentation. Without this, gateway-api JWT guards see
  // an unmapped user and return 403 (silent E2E failure mode).
  const roleRes = await fetch(
    `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/roles/${encodeURIComponent(roleName)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!roleRes.ok) {
    throw new Error(
      `Failed to fetch realm role '${roleName}': ${roleRes.status} ${roleRes.statusText}`,
    );
  }
  const role = (await roleRes.json()) as RealmRoleRep;
  const mapRes = await fetch(
    `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users/${userId}/role-mappings/realm`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify([role]),
    },
  );
  if (!mapRes.ok) {
    throw new Error(
      `Failed to map realm role '${roleName}' to user ${userId}: ${mapRes.status} ${mapRes.statusText}`,
    );
  }
}

/**
 * Create a Keycloak user with a pre-verified email and the `client` realm role.
 * Used to set up the conflict case (test 4) and the email-verified gate test (test 7).
 */
export async function setupTestUser(
  email: string,
  options: { emailVerified?: boolean } = {},
): Promise<string> {
  const token = await getAdminToken();
  const res = await fetch(`${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      email,
      emailVerified: options.emailVerified ?? true,
      enabled: true,
      username: email,
      firstName: 'Test',
      lastName: 'User',
      credentials: [{ type: 'password', value: 'TestPass-2026!', temporary: false }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to create test user ${email}: ${res.status} ${res.statusText}`);
  }
  const location = res.headers.get('Location') ?? '';
  const userId = location.split('/').pop() ?? '';
  if (!userId) {
    throw new Error(`Keycloak POST /users did not return a Location header for ${email}`);
  }
  await assignRealmRole(token, userId, 'client');
  return userId;
}

/**
 * Delete test users by email. Should be called in `afterEach` to prevent
 * state pollution across tests (idempotent — silently ignores 404s but raises
 * on auth / connectivity errors).
 */
export async function cleanupTestUsers(emails: string[]): Promise<void> {
  const token = await getAdminToken();
  for (const email of emails) {
    const searchRes = await fetch(
      `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users?email=${encodeURIComponent(email)}&exact=true`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (searchRes.status === 404) continue;
    if (!searchRes.ok) {
      throw new Error(
        `Keycloak user search failed for ${email}: ${searchRes.status} ${searchRes.statusText}`,
      );
    }
    const users = (await searchRes.json()) as Array<{ id: string }>;
    for (const user of users) {
      const delRes = await fetch(
        `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users/${user.id}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
      );
      if (!delRes.ok && delRes.status !== 404) {
        throw new Error(
          `Failed to delete Keycloak user ${user.id} (${email}): ${delRes.status} ${delRes.statusText}`,
        );
      }
    }
  }
}

// Exact-label regexes derived from `apps/public/src/messages/{fr,en}.json`
// (Story 1.2d AC5 i18n). Anchored to avoid substring collisions like the
// FR acceptMarketing label sharing letters with field labels.
const EMAIL_LABEL = /^(Adresse email|Email address)$/;
const PASSWORD_LABEL = /^(Mot de passe|Password)$/;
const FIRST_NAME_LABEL = /^(Prénom|First name)$/;
const LAST_NAME_LABEL = /^(Nom de famille|Last name)$/;
const ACCEPT_TERMS_NAME = /^(J'accepte|I accept).*/;
const CTA_NAME = /^(Créer mon compte|Create my account)$/;

/** Fill the registration form using exact i18n labels (Story 1.2d Playwright spec). */
export async function fillAndSubmitSignUpForm(
  page: Page,
  data: {
    email: string;
    password?: string;
    firstName?: string;
    lastName?: string;
    acceptTerms?: boolean;
  },
): Promise<void> {
  await page.getByLabel(EMAIL_LABEL).fill(data.email);
  if (data.firstName !== undefined) await page.getByLabel(FIRST_NAME_LABEL).fill(data.firstName);
  if (data.lastName !== undefined) await page.getByLabel(LAST_NAME_LABEL).fill(data.lastName);
  if (data.password !== undefined) await page.getByLabel(PASSWORD_LABEL).fill(data.password);
  if (data.acceptTerms !== false) {
    const checkbox = page.getByRole('checkbox', { name: ACCEPT_TERMS_NAME });
    if (!(await checkbox.isChecked())) await checkbox.click();
  }
  await page.getByRole('button', { name: CTA_NAME }).click();
}
