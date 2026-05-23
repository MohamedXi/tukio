import { type NextRequest, NextResponse } from 'next/server';
import { PreLaunchSignupSchema } from '@/features/pre-launch/schemas/pre-launch-signup.schema.js';
import { signupRatelimit } from '@/features/pre-launch/services/rate-limit-client.js';
import {
  parseAcquisitionCookie,
  TK_ACQ_COOKIE,
} from '@/features/pre-launch/services/parse-acquisition-cookie.js';
import {
  computePosition,
  getCachedPosition,
} from '@/features/pre-launch/services/compute-position.js';
import { logSignup } from '@/features/pre-launch/services/log-signup.js';
import {
  createResendContact,
  isResendDuplicateContact,
} from '@/features/pre-launch/services/create-resend-contact.js';

const IS_DEV_FALLBACK = process.env.NODE_ENV === 'development' && !process.env['RESEND_API_KEY'];

const MAX_BODY_BYTES = 16 * 1024; // 16 KB hard limit before request.json()
const RATE_LIMIT_MAX_RETRY_AFTER_SECONDS = 3600; // upper bound on Retry-After we emit

function extractClientIp(request: NextRequest): string {
  // X-Forwarded-For format: `client, proxy1, proxy2`. We trust the rightmost-from-client
  // hops as set by our reverse proxy (Caddy on DO Droplet). With a single trusted hop,
  // the second-to-last entry is the originating IP.
  // For deployments behind 0 proxies (direct), `request.ip` (Next.js) is authoritative.
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const hops = xff
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean);
    if (hops.length > 0) {
      // Trust = process.env.TRUSTED_PROXY_HOPS or default 1
      const trustedHops = Number.parseInt(process.env['TRUSTED_PROXY_HOPS'] ?? '1', 10);
      const idxFromRight = Math.max(0, hops.length - 1 - Math.max(0, trustedHops));
      return hops[idxFromRight] ?? 'unknown';
    }
  }
  return request.headers.get('x-real-ip') ?? 'unknown';
}

function isSameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const secFetchSite = request.headers.get('sec-fetch-site');
  // Browsers that send Sec-Fetch-Site: 'same-origin' or 'same-site' are safe.
  if (secFetchSite === 'same-origin' || secFetchSite === 'same-site' || secFetchSite === 'none') {
    return true;
  }
  // Fall back to Origin check against configured base URL.
  const base = process.env['NEXT_PUBLIC_BASE_URL'];
  if (!origin || !base) return false;
  try {
    return new URL(origin).origin === new URL(base).origin;
  } catch {
    return false;
  }
}

function clampRetryAfter(reset: number): number {
  const seconds = Math.ceil((reset - Date.now()) / 1000);
  return Math.max(1, Math.min(RATE_LIMIT_MAX_RETRY_AFTER_SECONDS, seconds));
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // CSRF — same-origin enforcement (P3)
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { ok: false, error: { tukioCode: 'PRE-LAUNCH-FORBIDDEN-001' } },
      { status: 403 },
    );
  }

  // Body size guard (P18)
  const contentLength = Number.parseInt(request.headers.get('content-length') ?? '0', 10);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { ok: false, error: { tukioCode: 'PRE-LAUNCH-PAYLOAD-TOO-LARGE-001' } },
      { status: 413 },
    );
  }

  // Rate limit (skip in dev fallback)
  if (!IS_DEV_FALLBACK) {
    const ip = extractClientIp(request);
    const { success, reset } = await signupRatelimit.limit(ip);
    if (!success) {
      const retryAfter = clampRetryAfter(reset);
      return NextResponse.json(
        { ok: false, error: { tukioCode: 'PRE-LAUNCH-RATE-LIMITED-001', retryAfter } },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } },
      );
    }
  }

  // Parse body
  const rawBody = await request.json().catch(() => null);
  const parsed = PreLaunchSignupSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: { tukioCode: 'PRE-LAUNCH-VALIDATION-001', issues: parsed.error.issues },
      },
      { status: 422 },
    );
  }
  const { firstName, lastName, email, role, locale } = parsed.data;

  // Read acquisition cookie (Story 0.13 tk_acq)
  const acquisition = parseAcquisitionCookie(request.cookies.get(TK_ACQ_COOKIE)?.value);

  // Dev fallback (after parsing so the form still validates locally)
  if (IS_DEV_FALLBACK) {
    const position = Math.floor(Math.random() * 200) + 100;
    logSignup({
      email,
      outcome: 'dev_fallback',
      position,
      role,
      locale,
      acquisitionSource: acquisition.source,
      acquisitionMedium: acquisition.medium,
      acquisitionCampaign: acquisition.campaign,
    });
    return NextResponse.json({ ok: true, position });
  }

  // Validate critical env at runtime (P5)
  const apiKey = process.env['RESEND_API_KEY'];
  const audienceId = process.env['RESEND_PRE_LAUNCH_AUDIENCE_ID'];
  if (!apiKey || !audienceId) {
    return NextResponse.json(
      { ok: false, error: { tukioCode: 'PRE-LAUNCH-EXTERNAL-001' } },
      { status: 502 },
    );
  }

  // Build properties for Resend custom fields (D1) — see create-resend-contact.ts.
  const properties: Record<string, string> = {
    role,
    locale,
    acquisition_source: acquisition.source,
  };
  if (acquisition.medium) properties['acquisition_medium'] = acquisition.medium;
  if (acquisition.campaign) properties['acquisition_campaign'] = acquisition.campaign;

  // Call Resend via raw REST (SDK 4.8 doesn't expose `properties` — D1 resolution)
  const result = await createResendContact(
    { audienceId, email, firstName, lastName, properties },
    apiKey,
  );

  if (!result.ok) {
    // Duplicate path (P1 + P15 — check name AND message, not just statusCode)
    if (isResendDuplicateContact(result.name, result.message)) {
      const position = await getCachedPosition(audienceId);
      logSignup({
        email,
        outcome: 'duplicate',
        position,
        role,
        locale,
        acquisitionSource: acquisition.source,
        acquisitionMedium: acquisition.medium,
        acquisitionCampaign: acquisition.campaign,
      });
      return NextResponse.json({ ok: true, position, alreadySubscribed: true });
    }
    // External error (Resend 5xx, auth, network)
    logSignup({
      email,
      outcome: 'failed',
      role,
      locale,
      acquisitionSource: acquisition.source,
      acquisitionMedium: acquisition.medium,
      acquisitionCampaign: acquisition.campaign,
      errorMessage: result.message,
    });
    return NextResponse.json(
      { ok: false, error: { tukioCode: 'PRE-LAUNCH-EXTERNAL-001' } },
      { status: 502 },
    );
  }

  // Compute position (cached + INCR — atomic, P23)
  const position = await computePosition(audienceId);

  logSignup({
    email,
    outcome: 'created',
    position,
    role,
    locale,
    acquisitionSource: acquisition.source,
    acquisitionMedium: acquisition.medium,
    acquisitionCampaign: acquisition.campaign,
  });

  return NextResponse.json({ ok: true, position });
}
