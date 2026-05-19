import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { PublicHeader } from '../../components/PublicHeader.js';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Home' });
  return {
    title: `Tukio — ${t('titleEmphasis')}`,
    description: t('subtitle'),
  };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Home' });

  return (
    <div className="min-h-screen bg-cream-50">
      <PublicHeader transparent />

      {/* ── Hero centré ───────────────────────────────────────────── */}
      <section className="px-6 pt-20 pb-16 text-center">
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-6">
          <span className="font-mono text-xs font-semibold tracking-widest uppercase text-brand-700">
            {t('kicker')}
          </span>

          <h1
            className="text-charcoal-800 leading-tight tracking-tight"
            style={{ fontSize: 'clamp(2.2rem, 5vw, 3.5rem)', fontWeight: 400 }}
          >
            {t('title')} <em className="not-italic text-brand-600">{t('titleEmphasis')}</em>
            {t('titleSuffix') ? ` ${t('titleSuffix')}` : '.'}
          </h1>

          <p className="text-lg text-charcoal-500 leading-relaxed max-w-xl">{t('subtitle')}</p>

          <div className="flex items-center gap-3 mt-2">
            <SignupButton locale={locale} label={t('ctaSignup')} />
          </div>
        </div>

        {/* ── Barre de recherche ──────────────────────────────────── */}
        <div className="mt-12 max-w-2xl mx-auto bg-cream-50 border border-cream-200 rounded-full shadow-md flex items-center p-1.5 gap-0">
          <SearchField label={t('searchWhat')} placeholder={t('searchWhatPlaceholder')} />
          <div className="w-px h-8 bg-cream-300 shrink-0" />
          <SearchField label={t('searchWhere')} placeholder={t('searchWherePlaceholder')} />
          <div className="w-px h-8 bg-cream-300 shrink-0" />
          <SearchField label={t('searchWhen')} placeholder={t('searchWhenPlaceholder')} />
          <button
            className="ml-1 mr-1 shrink-0 rounded-full bg-brand-500 hover:bg-brand-600 text-cream-50 font-medium text-sm px-5 py-2.5 transition-colors"
            type="button"
            aria-label={t('ctaSearch')}
          >
            {t('ctaSearch')}
          </button>
        </div>
      </section>
    </div>
  );
}

function SearchField({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <div className="flex flex-col px-5 py-1.5 min-w-0 flex-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-charcoal-700">
        {label}
      </span>
      <span className="text-sm text-charcoal-400 truncate">{placeholder}</span>
    </div>
  );
}

function SignupButton({ locale, label }: { locale: string; label: string }) {
  return (
    <a
      href={`/${locale}/auth/sign-up`}
      className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-500 hover:bg-brand-600 text-cream-50 font-medium text-base px-6 py-3 transition-colors"
    >
      {label}
    </a>
  );
}
