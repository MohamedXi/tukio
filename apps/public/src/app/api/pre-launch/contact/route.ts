import { type NextRequest, NextResponse } from 'next/server';
import { render } from '@react-email/render';
import { ContactFormSchema } from '@/features/public-pages/schemas/contact-form.schema.js';
import { ContactEmail } from '@/features/pre-launch/email-templates/ContactEmail.js';
import { resendClient } from '@/features/pre-launch/services/resend-client.js';
import { contactRatelimit } from '@/features/pre-launch/services/rate-limit-client.js';
import { logContact } from '@/features/pre-launch/services/log-contact.js';

const IS_DEV_FALLBACK = process.env.NODE_ENV === 'development' && !process.env['RESEND_API_KEY'];

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

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Rate limit
  if (!IS_DEV_FALLBACK) {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown';
    const { success, reset } = await contactRatelimit.limit(ip);
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
      outcome: 'sent',
      category: data.category,
      subject: data.subject,
      locale: data.locale,
    });
    return NextResponse.json({ ok: true });
  }

  // 3. Render + send email via Resend
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

    await resendClient.emails.send({
      from: process.env['RESEND_FROM_ADDRESS'] ?? 'Tukio <noreply@tukio.one>',
      to: [process.env['CONTACT_INBOX'] ?? 'contact@tukio.one'],
      replyTo: data.email,
      subject: `[Contact tukio.one] ${categoryLabel} — ${subjectLabel}`,
      html: renderedHtml,
    });

    logContact({
      email: data.email,
      outcome: 'sent',
      category: data.category,
      subject: data.subject,
      locale: data.locale,
    });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const resendErr = err as Record<string, unknown>;
    logContact({
      email: data.email,
      outcome: 'failed',
      category: data.category,
      subject: data.subject,
      locale: data.locale,
      errorMessage: typeof resendErr['message'] === 'string' ? resendErr['message'] : 'unknown',
    });
    return NextResponse.json(
      { ok: false, error: { tukioCode: 'PRE-LAUNCH-EXTERNAL-001' } },
      { status: 502 },
    );
  }
}
