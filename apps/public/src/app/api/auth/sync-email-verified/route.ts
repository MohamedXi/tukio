import { NextResponse, type NextRequest } from 'next/server';

/**
 * Cookie writer for the `tukio-email-verified` flag (Story 1.2d review patch P32 — D1).
 *
 * The Next.js middleware (`apps/public/src/middleware/auth-gate.ts`) reads this
 * cookie to gate transactional paths (FR17). The cookie is `HttpOnly=true` so
 * JS in the browser cannot tamper with it after issuance.
 *
 * Trust model: AuthProvider parses the JWT client-side via `keycloak-js` and
 * POSTs the parsed `email_verified` claim here. A malicious client scripting
 * `fetch(..., { body: '{ "emailVerified": true }' })` can only spoof their
 * OWN UX gate — the gateway-api remains the ultimate authority on the JWT
 * claim. See ADR-016 + the umbrella spec discussion of the MVP security model.
 *
 * Endpoints:
 *   POST   → set cookie (body: `{ "emailVerified": boolean }`)
 *   DELETE → clear cookie (called by `useLogout`)
 */

const COOKIE_NAME = 'tukio-email-verified';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const COOKIE_DOMAIN = process.env.NEXT_PUBLIC_COOKIE_DOMAIN ?? '.tukio.one';
const isProduction = process.env.NODE_ENV === 'production';

interface SyncBody {
  emailVerified?: unknown;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: SyncBody;
  try {
    body = (await request.json()) as SyncBody;
  } catch {
    return NextResponse.json(
      { error: 'invalid_body', message: 'Body must be JSON with `emailVerified` boolean.' },
      { status: 400 },
    );
  }
  if (typeof body.emailVerified !== 'boolean') {
    return NextResponse.json(
      { error: 'invalid_field', message: '`emailVerified` must be a boolean.' },
      { status: 400 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: COOKIE_NAME,
    value: body.emailVerified ? '1' : '0',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
    sameSite: 'lax',
    httpOnly: true,
    secure: isProduction,
    ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
  });
  return response;
}

export async function DELETE(): Promise<NextResponse> {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: COOKIE_NAME,
    value: '',
    maxAge: 0,
    path: '/',
    sameSite: 'lax',
    httpOnly: true,
    secure: isProduction,
    ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
  });
  return response;
}
