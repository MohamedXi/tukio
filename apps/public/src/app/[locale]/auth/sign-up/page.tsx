import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@tukio/ui/logo';
import { Avatar } from '@tukio/ui/avatar';
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

  const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL;
  if (!gatewayUrl && process.env.NODE_ENV === 'production') {
    throw new Error(
      'NEXT_PUBLIC_GATEWAY_URL is required in production builds (refusing to fall back to localhost).',
    );
  }

  /* Page rhythm — one-viewport layout with PER-COLUMN scroll fallback.
     Main is locked to viewport height (`h-screen`). Each column is its own
     scroll container (`overflow-y-auto`): when the viewport is tall enough,
     content centers without scrollbar; when it shrinks, the column scrolls
     internally so the user can still reach the CTA / read the testimonial. */
  return (
    <main className="flex h-screen w-full bg-cream-50 text-charcoal-700">
      {/* ─── Form column ───────────────────────────────────────── */}
      <section className="flex flex-1 flex-col overflow-y-auto px-6 py-6 md:px-16 md:py-10">
        <Logo size={34} />

        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center gap-5 py-6">
          <header className="flex flex-col gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-brand-700">
              {t('kicker')}
            </p>
            <h1 className="font-display text-[28px] font-medium leading-[1.1] tracking-[-0.01em] text-charcoal-800">
              {t('title')}
            </h1>
            <p className="text-sm leading-[1.5] text-charcoal-500">{t('subtitle')}</p>
          </header>

          <SignUpProviders gatewayUrl={gatewayUrl ?? 'http://localhost:4000'}>
            <SignUpForm />
          </SignUpProviders>
        </div>

        <footer className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-charcoal-400">
          <Link href={`/${locale}/legal/terms`} className="hover:text-charcoal-600">
            {t('footer.terms')}
          </Link>
          <Link href={`/${locale}/legal/privacy`} className="hover:text-charcoal-600">
            {t('footer.privacy')}
          </Link>
          <span className="ml-auto">{t('footer.copyright')}</span>
        </footer>
      </section>

      {/* ─── Editorial column (terracotta + testimonial) ────────── */}
      <aside
        className="relative hidden flex-1 flex-col overflow-y-auto bg-gradient-to-br from-brand-800 to-brand-600 px-12 py-12 text-cream-50 lg:flex"
        aria-hidden="true"
      >
        <div className="mt-auto flex max-w-md flex-col gap-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-brand-200">
            {t('editorial.kicker')}
          </p>
          <p className="font-display text-[32px] font-medium leading-[1.15] tracking-[-0.01em] text-cream-50">
            {t('editorial.quote')}
          </p>
          <div className="flex items-center gap-3">
            <Avatar name={t('editorial.author.name')} size={36} tone="brand" />
            <div className="flex flex-col gap-0.5">
              <div className="text-sm font-medium">{t('editorial.author.name')}</div>
              <div className="text-xs opacity-70">{t('editorial.author.role')}</div>
            </div>
          </div>
        </div>
      </aside>
    </main>
  );
}
