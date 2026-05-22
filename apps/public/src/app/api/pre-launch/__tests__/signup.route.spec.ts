import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock service modules (module-level singletons) — cleaner than mocking the SDKs.
vi.mock('@/features/pre-launch/services/rate-limit-client', () => ({
  signupRatelimit: {
    limit: vi.fn().mockResolvedValue({ success: true, reset: Date.now() + 60_000 }),
  },
  contactRatelimit: {
    limit: vi.fn().mockResolvedValue({ success: true, reset: Date.now() + 60_000 }),
  },
}));

vi.mock('@/features/pre-launch/services/log-signup', () => ({
  logSignup: vi.fn(),
}));

vi.mock('@/features/pre-launch/services/compute-position', () => ({
  computePosition: vi.fn().mockResolvedValue(248),
  getCachedPosition: vi.fn().mockResolvedValue(200),
}));

vi.mock('@/features/pre-launch/services/create-resend-contact', () => ({
  createResendContact: vi.fn().mockResolvedValue({ ok: true, id: 'contact-id' }),
  isResendDuplicateContact: vi.fn((name: string, message: string) => {
    const haystack = `${name} ${message}`.toLowerCase();
    return haystack.includes('already exists') || name === 'duplicate';
  }),
}));

import { POST } from '../signup/route.js';
import { signupRatelimit } from '@/features/pre-launch/services/rate-limit-client';
import { createResendContact } from '@/features/pre-launch/services/create-resend-contact';
import { logSignup } from '@/features/pre-launch/services/log-signup';

const ORIGIN = 'http://localhost:3000';

function makeRequest(
  body: unknown,
  opts: { cookieHeader?: string; origin?: string | null; xff?: string } = {},
): NextRequest {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'sec-fetch-site': 'same-origin',
    'x-forwarded-for': opts.xff ?? '127.0.0.1',
  };
  if (opts.origin === undefined) headers['origin'] = ORIGIN;
  else if (opts.origin !== null) headers['origin'] = opts.origin;
  if (opts.cookieHeader) headers['cookie'] = opts.cookieHeader;
  const json = JSON.stringify(body);
  headers['content-length'] = String(Buffer.byteLength(json, 'utf-8'));
  return new NextRequest(`${ORIGIN}/api/pre-launch/signup`, {
    method: 'POST',
    headers,
    body: json,
  });
}

const VALID_BODY = {
  firstName: 'Marie',
  lastName: 'Dupont',
  email: 'marie@example.com',
  role: 'organisateur',
  rgpdOptIn: true,
  locale: 'fr',
};

describe('POST /api/pre-launch/signup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env['RESEND_API_KEY'] = 're_test_key';
    process.env['RESEND_PRE_LAUNCH_AUDIENCE_ID'] = 'audience-uuid';
    process.env['NEXT_PUBLIC_BASE_URL'] = ORIGIN;
    vi.mocked(signupRatelimit.limit).mockResolvedValue({
      success: true,
      reset: Date.now() + 60_000,
    } as never);
    vi.mocked(createResendContact).mockResolvedValue({ ok: true, id: 'contact-id' });
  });

  it('returns 200 with position on happy path', async () => {
    const res = await POST(makeRequest(VALID_BODY));
    const body = (await res.json()) as { ok: boolean; position: number };
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.position).toBe(248);
  });

  it('returns 422 on invalid email', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, email: 'not-an-email' }));
    const body = (await res.json()) as { ok: boolean; error: { tukioCode: string } };
    expect(res.status).toBe(422);
    expect(body.error.tukioCode).toBe('PRE-LAUNCH-VALIDATION-001');
  });

  it('returns 422 on missing body', async () => {
    const res = await POST(makeRequest(null));
    expect(res.status).toBe(422);
  });

  it('returns 200 alreadySubscribed when Resend returns duplicate', async () => {
    vi.mocked(createResendContact).mockResolvedValueOnce({
      ok: false,
      status: 422,
      name: 'validation_error',
      message: 'Contact already exists in this audience',
    });
    const res = await POST(makeRequest(VALID_BODY));
    const body = (await res.json()) as { ok: boolean; alreadySubscribed?: boolean };
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.alreadySubscribed).toBe(true);
  });

  it('returns 502 when Resend is down', async () => {
    vi.mocked(createResendContact).mockResolvedValueOnce({
      ok: false,
      status: 503,
      name: 'service_unavailable',
      message: 'Resend is having issues',
    });
    const res = await POST(makeRequest(VALID_BODY));
    const body = (await res.json()) as { ok: boolean; error: { tukioCode: string } };
    expect(res.status).toBe(502);
    expect(body.error.tukioCode).toBe('PRE-LAUNCH-EXTERNAL-001');
  });

  it('returns 502 with PRE-LAUNCH-EXTERNAL-001 on real 422 validation (not duplicate)', async () => {
    vi.mocked(createResendContact).mockResolvedValueOnce({
      ok: false,
      status: 422,
      name: 'validation_error',
      message: 'invalid audience_id',
    });
    const res = await POST(makeRequest(VALID_BODY));
    const body = (await res.json()) as { ok: boolean; error: { tukioCode: string } };
    expect(res.status).toBe(502);
    expect(body.error.tukioCode).toBe('PRE-LAUNCH-EXTERNAL-001');
  });

  it('returns 429 when rate limit exceeded', async () => {
    vi.mocked(signupRatelimit.limit).mockResolvedValueOnce({
      success: false,
      reset: Date.now() + 30_000,
    } as never);
    const res = await POST(makeRequest(VALID_BODY));
    const body = (await res.json()) as {
      ok: boolean;
      error: { tukioCode: string; retryAfter: number };
    };
    expect(res.status).toBe(429);
    expect(body.error.tukioCode).toBe('PRE-LAUNCH-RATE-LIMITED-001');
    expect(res.headers.get('retry-after')).toBeTruthy();
  });

  it('returns 403 when cross-origin (no same-origin headers)', async () => {
    const res = await POST(
      new NextRequest(`${ORIGIN}/api/pre-launch/signup`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://evil.com',
          'sec-fetch-site': 'cross-site',
          'content-length': String(JSON.stringify(VALID_BODY).length),
        },
        body: JSON.stringify(VALID_BODY),
      }),
    );
    expect(res.status).toBe(403);
  });

  it('returns 413 when body exceeds 16KB', async () => {
    const huge = { ...VALID_BODY, firstName: 'x'.repeat(20000) };
    const json = JSON.stringify(huge);
    const res = await POST(
      new NextRequest(`${ORIGIN}/api/pre-launch/signup`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: ORIGIN,
          'sec-fetch-site': 'same-origin',
          'content-length': String(json.length),
        },
        body: json,
      }),
    );
    expect(res.status).toBe(413);
  });

  it('returns 502 if RESEND_API_KEY is missing in non-dev', async () => {
    delete process.env['RESEND_API_KEY'];
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(502);
  });

  it('passes acquisition source from tk_acq cookie to logSignup', async () => {
    const payload = { source: 'google_ads', medium: 'cpc', campaign: 'launch' };
    const cookie = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const res = await POST(makeRequest(VALID_BODY, { cookieHeader: `tk_acq=${cookie}` }));
    expect(res.status).toBe(200);
    expect(vi.mocked(logSignup)).toHaveBeenCalledWith(
      expect.objectContaining({
        acquisitionSource: 'google_ads',
        acquisitionMedium: 'cpc',
        acquisitionCampaign: 'launch',
      }),
    );
  });

  it('passes audienceId + properties to createResendContact', async () => {
    const payload = { source: 'google_ads', medium: 'cpc', campaign: 'launch' };
    const cookie = Buffer.from(JSON.stringify(payload)).toString('base64url');
    await POST(makeRequest(VALID_BODY, { cookieHeader: `tk_acq=${cookie}` }));
    expect(vi.mocked(createResendContact)).toHaveBeenCalledWith(
      expect.objectContaining({
        audienceId: 'audience-uuid',
        email: 'marie@example.com',
        firstName: 'Marie',
        lastName: 'Dupont',
        properties: expect.objectContaining({
          role: 'organisateur',
          locale: 'fr',
          acquisition_source: 'google_ads',
          acquisition_medium: 'cpc',
          acquisition_campaign: 'launch',
        }),
      }),
      're_test_key',
    );
  });

  it('logs role/locale/acquisitionSource on duplicate path', async () => {
    vi.mocked(createResendContact).mockResolvedValueOnce({
      ok: false,
      status: 422,
      name: 'validation_error',
      message: 'Contact already exists',
    });
    await POST(makeRequest(VALID_BODY));
    expect(vi.mocked(logSignup)).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'duplicate',
        role: 'organisateur',
        locale: 'fr',
      }),
    );
  });
});
