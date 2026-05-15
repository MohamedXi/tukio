import { type NextRequest, NextResponse } from 'next/server';
import {
  parseUtmParams,
  isAcquisitionSource,
  type AcquisitionContext,
  type AcquisitionSource,
} from '@tukio/contracts/types/Acquisition';

const COOKIE_NAME = 'tukio-acquisition';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days in seconds
// Allow override for local dev (localhost doesn't accept Domain=.tukio.one).
// Set NEXT_PUBLIC_COOKIE_DOMAIN="" in .env.local to omit the domain attribute.
const COOKIE_DOMAIN = process.env.NEXT_PUBLIC_COOKIE_DOMAIN ?? '.tukio.one';

function parseExistingCookie(cookieValue: string): AcquisitionContext | undefined {
  try {
    const parsed = JSON.parse(decodeURIComponent(cookieValue)) as Record<string, unknown>;
    // Minimal validation — reject structurally invalid cookies to prevent
    // corrupt data from propagating into attribution DB columns.
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed['firstTouch'] !== 'string' ||
      typeof parsed['lastTouch'] !== 'string' ||
      !isAcquisitionSource(String(parsed['source'] ?? ''))
    ) {
      return undefined;
    }
    return parsed as unknown as AcquisitionContext;
  } catch {
    return undefined;
  }
}

// Non-empty referer does not imply organic — it could be any social/paid source
// without UTM params. 'unknown' is the correct default for untracked referrers.
function inferSourceFromReferer(referer: string | null): AcquisitionSource {
  if (!referer || referer.trim() === '') return 'direct';
  return 'unknown';
}

function setCookie(response: NextResponse, ctx: AcquisitionContext): void {
  const cookieOptions = {
    name: COOKIE_NAME,
    value: encodeURIComponent(JSON.stringify(ctx)),
    maxAge: COOKIE_MAX_AGE,
    path: '/',
    sameSite: 'lax' as const,
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
  };
  response.cookies.set(cookieOptions);
}

/**
 * Middleware that sets/updates the tukio-acquisition cookie on every request.
 *
 * - If UTM params are present: extract source/medium/campaign and write/update cookie.
 * - If no UTM params and no existing cookie: infer source from Referer header.
 * - If no UTM params and cookie already exists: leave cookie untouched.
 * - Multi-touch: preserves firstTouch, always updates lastTouch + source/medium/campaign
 *   when new UTM params are detected.
 *
 * The cookie is read by gateway-api (Story Epic 1+) at user registration and booking
 * creation to persist acquisition attribution into the database.
 */
export function acquisitionCookieMiddleware(request: NextRequest): NextResponse {
  const response = NextResponse.next();

  const { searchParams } = request.nextUrl;
  const utmParams = parseUtmParams(searchParams);
  const hasUtm = utmParams.source !== undefined;

  const existingCookieValue = request.cookies.get(COOKIE_NAME)?.value;
  const existing = existingCookieValue ? parseExistingCookie(existingCookieValue) : undefined;

  const now = new Date().toISOString();

  if (hasUtm) {
    const updated: AcquisitionContext = {
      source: utmParams.source!,
      medium: utmParams.medium,
      campaign: utmParams.campaign,
      referralId: existing?.referralId,
      firstTouch: existing?.firstTouch ?? now,
      lastTouch: now,
    };
    setCookie(response, updated);
  } else if (!existing) {
    const referer = request.headers.get('referer');
    const source = inferSourceFromReferer(referer);
    setCookie(response, { source, firstTouch: now, lastTouch: now });
  }
  // If no UTM and cookie already exists: leave cookie untouched.

  return response;
}
