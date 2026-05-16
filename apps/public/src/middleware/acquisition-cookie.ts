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

// `tk_acq` — first-touch-only acquisition cookie consumed by gateway-api (Story 1.2c/d).
// Base64url-encoded JSON matching `AcquisitionInputDto` from @tukio/contracts.
// NEVER overwritten once set (first-touch wins — K-04). 90-day TTL.
const TK_ACQ_COOKIE = 'tk_acq';
const TK_ACQ_MAX_AGE = 60 * 60 * 24 * 90;

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

/** Encode an acquisition payload as base64url JSON for the `tk_acq` cookie. */
function encodeTkAcq(payload: Record<string, string | undefined>): string {
  const compacted = Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined));
  const json = JSON.stringify(compacted);
  // Edge runtime + Node.js both have Buffer via Next.js polyfill.
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(json).toString('base64url');
  }
  // TextEncoder-based fallback for pure Web runtimes without Buffer.
  // (Avoids the deprecated `unescape(encodeURIComponent(...))` UTF-8 trick.)
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function setTkAcqCookie(
  response: NextResponse,
  source: AcquisitionSource,
  medium: string | undefined,
  campaign: string | undefined,
): void {
  response.cookies.set({
    name: TK_ACQ_COOKIE,
    value: encodeTkAcq({ source, medium, campaign }),
    maxAge: TK_ACQ_MAX_AGE,
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
  });
}

/**
 * Middleware that sets/updates the tukio-acquisition cookie on every request.
 *
 * `tukio-acquisition` — multi-touch tracking (preserves firstTouch, updates lastTouch).
 * `tk_acq`             — first-touch-only, base64url JSON, read by gateway-api (Story 1.2c).
 *
 * - UTM params present: write/update `tukio-acquisition`; write `tk_acq` only if not already set.
 * - No UTM, no existing cookie: infer source from Referer; set both cookies.
 * - No UTM, cookie already exists: leave `tukio-acquisition` untouched; skip `tk_acq` (already set).
 */
export function acquisitionCookieMiddleware(request: NextRequest): NextResponse {
  const response = NextResponse.next();

  const { searchParams } = request.nextUrl;
  const utmParams = parseUtmParams(searchParams);
  const hasUtm = utmParams.source !== undefined;

  const existingCookieValue = request.cookies.get(COOKIE_NAME)?.value;
  const existing = existingCookieValue ? parseExistingCookie(existingCookieValue) : undefined;
  const tkAcqAlreadySet = Boolean(request.cookies.get(TK_ACQ_COOKIE)?.value);

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
    if (!tkAcqAlreadySet) {
      setTkAcqCookie(response, utmParams.source!, utmParams.medium, utmParams.campaign);
    }
  } else if (!existing) {
    const referer = request.headers.get('referer');
    const source = inferSourceFromReferer(referer);
    setCookie(response, { source, firstTouch: now, lastTouch: now });
    if (!tkAcqAlreadySet) {
      setTkAcqCookie(response, source, undefined, undefined);
    }
  }
  // If no UTM and cookie already exists: leave both cookies untouched.

  return response;
}
