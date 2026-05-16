import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckIcon } from 'lucide-react';
import { Typography } from '@tukio/ui/typography';
import { AuthShell } from '../../../../../features/auth/components/AuthShell.js';
import { ResendEmailButton } from '../../../../../features/auth/verify-email/components/ResendEmailButton.js';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth.verifyEmailRequired' });
  return {
    title: `${t('title')} — Tukio`,
  };
}

export default async function VerifyEmailRequiredPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ email?: string }>;
}) {
  const { locale } = await params;
  const { email } = await searchParams;
  const t = await getTranslations({ locale, namespace: 'auth.verifyEmailRequired' });

  return (
    <AuthShell
      side="left"
      locale={locale}
      kicker={t('kicker')}
      title={t('title')}
      subtitle={email ? t('subtitleWithEmail', { email }) : t('subtitleWithoutEmail')}
      editorial={{
        kicker: t('editorial.kicker'),
        quote: t('editorial.quote'),
        authorName: t('editorial.author.name'),
        authorRole: t('editorial.author.role'),
      }}
      footerLinks={[
        { href: `/${locale}/legal/terms`, label: t('footer.terms') },
        { href: `/${locale}/legal/privacy`, label: t('footer.privacy') },
      ]}
      footerCopyright={t('footer.copyright')}
    >
      <div className="flex flex-col gap-5">
        {/* ─── Email-sent confirmation card ─────────────────────── */}
        <div className="flex items-center gap-4 rounded-lg border border-cream-300 bg-cream-100 p-5">
          <div
            className="flex size-14 shrink-0 items-center justify-center rounded-full bg-success-50 text-success-700"
            aria-hidden="true"
          >
            <CheckIcon size={28} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col gap-1">
            <Typography variant="subtitle2">
              {email
                ? t('confirmationCard.titleWithEmail', { email })
                : t('confirmationCard.titleWithoutEmail')}
            </Typography>
            <Typography variant="body2" color="muted">
              {t('confirmationCard.subtitle')}
            </Typography>
          </div>
        </div>

        {/* ─── Resend CTA (countdown, Story 1.6 stub) ───────────── */}
        <ResendEmailButton initialCountdownSeconds={60} />

        {/* ─── Help box ─────────────────────────────────────────── */}
        <Typography
          variant="body2"
          color="muted"
          as="div"
          className="rounded-md bg-cream-100 p-4 leading-relaxed"
        >
          <strong className="text-charcoal-700">{t('help.title')}</strong>{' '}
          {t.rich('help.body', {
            support: (chunks) => (
              <a
                href="mailto:support@tukio.one"
                className="font-medium text-brand-700 hover:underline"
              >
                {chunks}
              </a>
            ),
            change: (chunks) => (
              <Link
                href={`/${locale}/auth/sign-up`}
                className="font-medium text-brand-700 hover:underline"
              >
                {chunks}
              </Link>
            ),
          })}
        </Typography>

        {/* ─── Back link ────────────────────────────────────────── */}
        <Typography variant="body2" align="center">
          <Link
            href={`/${locale}/auth/login`}
            className="font-medium text-charcoal-600 hover:underline"
          >
            {t('backToLogin')}
          </Link>
        </Typography>
      </div>
    </AuthShell>
  );
}
