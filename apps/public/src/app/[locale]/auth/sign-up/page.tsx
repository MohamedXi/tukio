import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { AuthShell } from '../../../../features/auth/components/AuthShell.js';
import { SignUpForm } from '../../../../features/auth/sign-up/index.js';
import { SignUpProviders } from '../../../../features/auth/sign-up/components/SignUpProviders.js';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth.signup' });
  return {
    title: `${t('title')} — Tukio`,
    description: t('subtitle'),
  };
}

export default async function SignUpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth.signup' });

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl && process.env.NODE_ENV === 'production') {
    throw new Error(
      'NEXT_PUBLIC_API_URL is required in production builds (refusing to fall back to localhost).',
    );
  }

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
      <SignUpProviders gatewayUrl={apiUrl ?? 'http://localhost:4000'}>
        <SignUpForm />
      </SignUpProviders>
    </AuthShell>
  );
}
