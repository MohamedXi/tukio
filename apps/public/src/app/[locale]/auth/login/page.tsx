import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '../../../../features/auth/components/AuthShell.js';
import { LoginCta } from '../../../../features/auth/login/index.js';
import { Alert } from '@tukio/ui/alert';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth.login' });
  return {
    title: `${t('title')} — Tukio`,
    description: t('subtitle'),
  };
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: 'auth.login' });

  const rawError = sp['error'];
  const errorParam = Array.isArray(rawError) ? rawError[0] : rawError;
  const isServiceError = errorParam === 'service_unavailable';
  const errorMessage = errorParam
    ? isServiceError
      ? t('errors.serviceUnavailable')
      : t('errors.invalidCredentials')
    : null;

  return (
    <AuthShell
      side="right"
      locale={locale}
      kicker={t('kicker')}
      title={t('title')}
      subtitle={t('subtitle')}
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
      <div className="flex flex-col gap-4">
        {errorMessage && (
          <Alert variant="error" role="alert">
            {errorMessage}
          </Alert>
        )}

        {/* Visual hints only — auth happens on Keycloak hosted page.
            Hidden from AT so screen-reader users go directly to the CTA. */}
        <div aria-hidden="true" className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-charcoal-700">
              {t('fields.email.label')}
            </label>
            <input
              type="email"
              autoComplete="email"
              className="w-full rounded-md border border-charcoal-200 bg-cream-50 px-3 py-2 text-sm outline-none"
              tabIndex={-1}
              readOnly
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-charcoal-700">
              {t('fields.password.label')}
            </label>
            <input
              type="password"
              autoComplete="current-password"
              className="w-full rounded-md border border-charcoal-200 bg-cream-50 px-3 py-2 text-sm outline-none"
              tabIndex={-1}
              readOnly
            />
          </div>
          <div className="text-right">
            <span className="text-sm text-brand-600">{t('forgotPassword')}</span>
          </div>
        </div>

        <div className="text-right" aria-hidden="false">
          <Link
            href={`/${locale}/auth/password-reset`}
            className="text-sm text-brand-600 hover:underline"
          >
            {t('forgotPassword')}
          </Link>
        </div>

        <LoginCta locale={locale} ctaLabel={t('cta')} loadingLabel={t('loading')} />

        <p className="text-center text-sm text-charcoal-500">
          {t('noAccount')}{' '}
          <Link
            href={`/${locale}/auth/sign-up`}
            className="font-medium text-brand-600 hover:underline"
          >
            {t('noAccountLink')}
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
