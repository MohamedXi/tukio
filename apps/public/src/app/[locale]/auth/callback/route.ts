import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * OAuth callback route — Story 1.4c.
 *
 * Forwards the code + state to gateway-api server-side instead of relying on
 * a browser redirect. This avoids a SameSite cross-port cookie issue: the
 * browser doesn't reliably forward the `tukio-pkce-state` cookie (set by
 * localhost:4000) when following a redirect from localhost:3000 → localhost:4000
 * in some browser/OS combinations (Safari ITP, Chrome SameSite strict contexts).
 *
 * Server-to-server call:
 *  1. Read the `tukio-pkce-state` cookie from the INCOMING browser request
 *     (browser → Next.js:3000). The cookie reaches here correctly because
 *     Keycloak → localhost:3000 is a top-level navigation (SameSite=Lax ✓).
 *  2. Call gateway-api with that cookie + code + state.
 *  3. Forward the session cookies from gateway-api to the browser.
 *  4. Redirect the browser to the post-login destination.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const url = new URL(req.url);
  const error = url.searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL(`/${locale}`, req.url));
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const gatewayUrl = process.env['NEXT_PUBLIC_GATEWAY_URL'] ?? 'http://localhost:4000';

  const gatewayCallbackUrl = new URL(`${gatewayUrl}/v1/auth/callback`);
  if (code) gatewayCallbackUrl.searchParams.set('code', code);
  if (state) gatewayCallbackUrl.searchParams.set('state', state);
  gatewayCallbackUrl.searchParams.set('locale', locale);

  // Forward the pkce-state cookie (browser sent it here; we relay to gateway-api)
  const pkceCookie = req.cookies.get('tukio-pkce-state');
  const cookieHeader = pkceCookie ? `tukio-pkce-state=${pkceCookie.value}` : '';

  try {
    const gwResponse = await fetch(gatewayCallbackUrl.toString(), {
      method: 'GET',
      headers: {
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        'User-Agent': req.headers.get('user-agent') ?? '',
      },
      redirect: 'manual',
    });

    const redirectTo = gwResponse.headers.get('location');

    // Collect Set-Cookie headers from gateway-api response
    const setCookies: string[] = gwResponse.headers.getSetCookie
      ? gwResponse.headers.getSetCookie()
      : [];

    const destination = redirectTo ?? `/${locale}`;
    const nextResponse = NextResponse.redirect(new URL(destination, req.url));

    for (const cookie of setCookies) {
      nextResponse.headers.append('Set-Cookie', cookie);
    }

    return nextResponse;
  } catch {
    // Gateway unreachable — go home
    return NextResponse.redirect(new URL(`/${locale}`, req.url));
  }
}
