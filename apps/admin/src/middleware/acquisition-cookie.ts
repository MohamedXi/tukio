import { type NextRequest, NextResponse } from 'next/server';
import {
  parseUtmParams,
  type AcquisitionContext,
  type AcquisitionSource,
} from '@tukio/contracts/types/Acquisition';

const COOKIE_NAME = 'tukio-acquisition';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days in seconds
const COOKIE_DOMAIN = '.tukio.one';

function parseExistingCookie(cookieValue: string): AcquisitionContext | undefined {
  try {
    return JSON.parse(decodeURIComponent(cookieValue)) as AcquisitionContext;
  } catch {
    return undefined;
  }
}

function inferSourceFromReferer(referer: string | null): AcquisitionSource {
  if (!referer || referer.trim() === '') return 'direct';
  return 'organic';
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
    // UTM params present: update acquisition context (multi-touch attribution).
    const updated: AcquisitionContext = {
      source: utmParams.source!,
      medium: utmParams.medium,
      campaign: utmParams.campaign,
      referralId: existing?.referralId,
      firstTouch: existing?.firstTouch ?? now,
      lastTouch: now,
    };
    response.cookies.set({
      name: COOKIE_NAME,
      value: encodeURIComponent(JSON.stringify(updated)),
      maxAge: COOKIE_MAX_AGE,
      domain: COOKIE_DOMAIN,
      path: '/',
      sameSite: 'lax',
      httpOnly: false, // Must be readable by client-side JS and server-side middleware
      secure: process.env.NODE_ENV === 'production',
    });
  } else if (!existing) {
    // No UTM params and no existing cookie: infer source from Referer.
    const referer = request.headers.get('referer');
    const source = inferSourceFromReferer(referer);
    const initial: AcquisitionContext = {
      source,
      firstTouch: now,
      lastTouch: now,
    };
    response.cookies.set({
      name: COOKIE_NAME,
      value: encodeURIComponent(JSON.stringify(initial)),
      maxAge: COOKIE_MAX_AGE,
      domain: COOKIE_DOMAIN,
      path: '/',
      sameSite: 'lax',
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
    });
  }
  // If no UTM and cookie already exists: leave cookie untouched.

  return response;
}
