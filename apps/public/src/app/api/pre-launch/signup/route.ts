import { type NextRequest, NextResponse } from 'next/server';
import { PreLaunchSignupSchema } from '@/features/pre-launch/schemas/pre-launch-signup.schema.js';
import { resendClient } from '@/features/pre-launch/services/resend-client.js';
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

// Dev fallback: when no RESEND_API_KEY is configured (local dev without Resend),
// skip the real API call and return a mock response.
const IS_DEV_FALLBACK = process.env.NODE_ENV === 'development' && !process.env['RESEND_API_KEY'];

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Rate limit (skip in dev fallback mode)
  if (!IS_DEV_FALLBACK) {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown';
    const { success, reset } = await signupRatelimit.limit(ip);
    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000);
      return NextResponse.json(
        { ok: false, error: { tukioCode: 'PRE-LAUNCH-RATE-LIMITED-001', retryAfter } },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } },
      );
    }
  }

  // 2. Parse body
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

  // Dev fallback: return a random mock position without calling Resend or Upstash.
  if (IS_DEV_FALLBACK) {
    const position = Math.floor(Math.random() * 200) + 100;
    return NextResponse.json({ ok: true, position });
  }

  // 3. Read acquisition cookie (Story 0.13 tk_acq)
  const acqCookieValue = request.cookies.get(TK_ACQ_COOKIE)?.value;
  const acquisition = parseAcquisitionCookie(acqCookieValue);

  // 4. Create Resend contact
  const audienceId = process.env['RESEND_PRE_LAUNCH_AUDIENCE_ID'] ?? '';
  try {
    await resendClient.contacts.create({
      audienceId,
      email,
      firstName,
      lastName,
      unsubscribed: false,
    });
  } catch (err: unknown) {
    const resendErr = err as Record<string, unknown>;
    // Resend returns 422 with name 'validation_error' for duplicate emails
    if (
      resendErr['statusCode'] === 422 ||
      resendErr['statusCode'] === 409 ||
      (typeof resendErr['name'] === 'string' && resendErr['name'].includes('duplicate'))
    ) {
      const position = await getCachedPosition(audienceId);
      logSignup({ email, outcome: 'duplicate', position });
      return NextResponse.json({ ok: true, position, alreadySubscribed: true });
    }
    logSignup({
      email,
      outcome: 'failed',
      role,
      locale,
      acquisitionSource: acquisition.source,
      errorMessage: typeof resendErr['message'] === 'string' ? resendErr['message'] : 'unknown',
    });
    return NextResponse.json(
      { ok: false, error: { tukioCode: 'PRE-LAUNCH-EXTERNAL-001' } },
      { status: 502 },
    );
  }

  // 5. Compute position (cached 5min)
  const position = await computePosition(audienceId);

  // 6. Log (PII redacted by pino)
  logSignup({
    email,
    outcome: 'created',
    position,
    role,
    locale,
    acquisitionSource: acquisition.source,
  });

  return NextResponse.json({ ok: true, position });
}
