import type { Page } from '@playwright/test';

const KEYCLOAK_URL = process.env['E2E_KEYCLOAK_URL'] ?? 'http://localhost:8080';
const REALM = process.env['E2E_KEYCLOAK_REALM'] ?? 'tukio';
const CLIENT_ID = process.env['E2E_KEYCLOAK_CLIENT_ID'] ?? 'tukio-public';

const TEST_CUSTOMER_EMAIL = process.env['E2E_TEST_CUSTOMER_EMAIL'] ?? 'e2e-customer@tukio.test';
const TEST_CUSTOMER_PASSWORD = process.env['E2E_TEST_CUSTOMER_PASSWORD'] ?? 'E2ePassword123!';

async function getTokenDirect(): Promise<string> {
  const res = await fetch(`${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: CLIENT_ID,
      username: TEST_CUSTOMER_EMAIL,
      password: TEST_CUSTOMER_PASSWORD,
      scope: 'openid',
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Keycloak ROPC token exchange failed (${res.status}): ${body}\n` +
        'Check that directGrantsEnabled=true is set on the tukio realm and ' +
        'that E2E_TEST_CUSTOMER_EMAIL/E2E_TEST_CUSTOMER_PASSWORD are correct.',
    );
  }
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

export async function authenticateCustomer(page: Page): Promise<void> {
  const token = await getTokenDirect();
  await page.context().addCookies([
    {
      name: 'tukio-access-token',
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
    },
    {
      name: 'tukio-session-active',
      value: '1',
      domain: 'localhost',
      path: '/',
    },
  ]);
}
