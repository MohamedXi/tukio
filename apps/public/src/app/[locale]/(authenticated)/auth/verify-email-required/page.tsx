import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { Alert } from '@tukio/ui/alert';
import { Button } from '@tukio/ui/button';

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
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth.verifyEmailRequired' });

  return (
    <main className="min-h-screen flex items-center justify-center bg-cream-50 px-4 py-12">
      <div className="w-full max-w-md">
        <Alert variant="warning" title={t('title')}>
          <p className="mt-1 text-sm">{t('description')}</p>
          <Button
            type="button"
            variant="secondary"
            className="mt-4"
            disabled
            title="Story 1.6"
            aria-label={`${t('ctaResend')} (Story 1.6)`}
          >
            {t('ctaResend')}
          </Button>
          <p className="mt-4 text-sm text-charcoal-500">{t('support')}</p>
        </Alert>
      </div>
    </main>
  );
}
