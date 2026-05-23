import { type NextRequest, NextResponse } from 'next/server';
import { render } from '@react-email/render';
import { ContactFormSchema } from '@/features/public-pages/schemas/contact-form.schema.js';
import { ContactEmail } from '@/features/pre-launch/email-templates/ContactEmail.js';
import { resendClient } from '@/features/pre-launch/services/resend-client.js';
import { contactRatelimit } from '@/features/pre-launch/services/rate-limit-client.js';
import { logContact } from '@/features/pre-launch/services/log-contact.js';

const IS_DEV_FALLBACK = process.env.NODE_ENV === 'development' && !process.env['RESEND_API_KEY'];

const MAX_BODY_BYTES = 32 * 1024; // 32 KB — larger than signup to accept message body
const RATE_LIMIT_MAX_RETRY_AFTER_SECONDS = 3600;

const CATEGORY_LABELS: Record<string, string> = {
  organisateur: 'Organisateur',
  professionnel: "Professionnel de l'événementiel",
  journaliste: 'Journaliste / Médias',
  partenaire: 'Partenariat',
  autre: 'Autre',
};

const SUBJECT_LABELS: Record<string, string> = {
  general: 'Question générale',
  devenirPro: 'Devenir Professionnel',
  technique: 'Support technique',
  partenariat: 'Partenariat',
  presse: 'Presse / Médias',
};

function extractClientIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const hops = xff
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean);
    if (hops.length > 0) {
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
  if (secFetchSite === 'same-origin' || secFetchSite === 'same-site' || secFetchSite === 'none') {
    return true;
  }
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

  // Rate limit
  if (!IS_DEV_FALLBACK) {
    const ip = extractClientIp(request);
    const { success, reset } = await contactRatelimit.limit(ip);
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
  const parsed = ContactFormSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: { tukioCode: 'PRE-LAUNCH-VALIDATION-001', issues: parsed.error.issues },
      },
      { status: 422 },
    );
  }
  const data = parsed.data;

  // Dev fallback
  if (IS_DEV_FALLBACK) {
    logContact({
      email: data.email,
      outcome: 'dev_fallback',
      category: data.category,
      subject: data.subject,
      locale: data.locale,
    });
    return NextResponse.json({ ok: true });
  }

  // Env validation (P5)
  const fromAddress = process.env['RESEND_FROM_ADDRESS'];
  const contactInbox = process.env['CONTACT_INBOX'];
  if (!fromAddress || !contactInbox || !process.env['RESEND_API_KEY']) {
    return NextResponse.json(
      { ok: false, error: { tukioCode: 'PRE-LAUNCH-EXTERNAL-001' } },
      { status: 502 },
    );
  }

  // Defense-in-depth: reject CRLF in email even though schema does (P4 belt+suspenders)
  if (/[\r\n]/.test(data.email)) {
    return NextResponse.json(
      {
        ok: false,
        error: { tukioCode: 'PRE-LAUNCH-VALIDATION-001' },
      },
      { status: 422 },
    );
  }

  // Render + send (P1 — Resend SDK returns { data, error })
  try {
    const renderedHtml = await render(
      ContactEmail({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        category: data.category,
        subject: data.subject,
        message: data.message,
        locale: data.locale,
      }),
    );

    const categoryLabel = CATEGORY_LABELS[data.category] ?? data.category;
    const subjectLabel = SUBJECT_LABELS[data.subject] ?? data.subject;

    const sendResult = await resendClient.emails.send({
      from: fromAddress,
      to: [contactInbox],
      replyTo: data.email,
      subject: `[Contact tukio.one] ${categoryLabel} — ${subjectLabel}`,
      html: renderedHtml,
    });

    if (sendResult.error) {
      logContact({
        email: data.email,
        outcome: 'failed',
        category: data.category,
        subject: data.subject,
        locale: data.locale,
        errorMessage: sendResult.error.message,
      });
      return NextResponse.json(
        { ok: false, error: { tukioCode: 'PRE-LAUNCH-EXTERNAL-001' } },
        { status: 502 },
      );
    }

    logContact({
      email: data.email,
      outcome: 'sent',
      category: data.category,
      subject: data.subject,
      locale: data.locale,
    });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown';
    logContact({
      email: data.email,
      outcome: 'failed',
      category: data.category,
      subject: data.subject,
      locale: data.locale,
      errorMessage: message,
    });
    return NextResponse.json(
      { ok: false, error: { tukioCode: 'PRE-LAUNCH-EXTERNAL-001' } },
      { status: 502 },
    );
  }
}
