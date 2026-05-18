import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const url = new URL(req.url);
  const error = url.searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      new URL(`/${locale}/auth/login?error=${encodeURIComponent(error)}`, req.url),
    );
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const gatewayUrl = process.env['NEXT_PUBLIC_GATEWAY_URL'] ?? 'http://localhost:4000';

  const gatewayCallbackUrl = new URL(`${gatewayUrl}/v1/auth/callback`);
  if (code) gatewayCallbackUrl.searchParams.set('code', code);
  if (state) gatewayCallbackUrl.searchParams.set('state', state);
  gatewayCallbackUrl.searchParams.set('locale', locale);

  return NextResponse.redirect(gatewayCallbackUrl);
}
