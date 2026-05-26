import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Footer } from '@tukio/ui/patterns/Footer';
import { ComingSoonHeader } from '../../../features/pre-launch/components/ComingSoonHeader.js';
import { ComingSoonHero } from '../../../features/pre-launch/components/ComingSoonHero.js';
import { ComingSoonFormClient } from '../../../features/pre-launch/components/ComingSoonFormClient.js';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ role?: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'coming_soon.meta' });
  const baseUrl = process.env['NEXT_PUBLIC_BASE_URL'] ?? 'https://tukio.one';
  return {
    title: t('title'),
    description: t('description'),
    openGraph: {
      title: t('title'),
      description: t('description'),
      type: 'website',
      locale: locale === 'fr' ? 'fr_FR' : 'en_US',
      siteName: 'tukio.one',
      images: [{ url: `${baseUrl}/og/coming-soon.png`, width: 1200, height: 630, alt: t('title') }],
      url: `${baseUrl}/${locale}/coming-soon`,
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('description'),
      images: [`${baseUrl}/og/coming-soon.png`],
    },
    alternates: {
      canonical: `${baseUrl}/${locale}/coming-soon`,
      languages: {
        fr: `${baseUrl}/fr/coming-soon`,
        en: `${baseUrl}/en/coming-soon`,
        'x-default': `${baseUrl}/fr/coming-soon`,
      },
    },
    // Indexable: this is the primary pre-launch landing — sitemap lists it at
    // priority 1.0 and robots.txt allows it, so search engines should rank it
    // to capture organic waitlist signups. (The /success page stays noindex.)
    robots: { index: true, follow: true },
  };
}

export default async function ComingSoonPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { role } = await searchParams;

  const tFooter = await getTranslations({ locale, namespace: 'coming_soon.footer' });
  const tHeader = await getTranslations({ locale, namespace: 'coming_soon.header' });
  const year = new Date().getFullYear();
  const sellerBaseUrl = process.env['NEXT_PUBLIC_SELLER_BASE_URL'] ?? 'https://seller.tukio.one';

  const initialRole: 'organisateur' | 'professionnel' =
    role === 'pro' ? 'professionnel' : 'organisateur';

  return (
    <div className="min-h-screen flex flex-col bg-cream-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:outline-none"
      >
        {tHeader('skipToForm')}
      </a>

      <ComingSoonHeader locale={locale} />

      <main id="main-content" className="flex-1 grid grid-cols-[1.1fr_1fr] max-lg:grid-cols-1">
        <ComingSoonHero locale={locale} />

        <section
          className="bg-cream-100 border-l border-cream-200 flex flex-col justify-center pt-16 pb-20 px-16 max-lg:border-l-0 max-lg:border-t max-lg:px-6 max-lg:pt-10 max-lg:pb-12"
          aria-labelledby="coming-soon-form-heading"
        >
          <ComingSoonFormClient locale={locale} initialRole={initialRole} />
        </section>
      </main>

      <Footer
        variant="minimal"
        legal={tFooter('legal', { year })}
        inlineLinks={[
          {
            label: tFooter('linkBecomePro'),
            href: `${sellerBaseUrl}/${locale}/seller-coming-soon`,
          },
          { label: tFooter('linkLegalNotice'), href: `/${locale}/legal` },
          { label: tFooter('linkContactEmail'), href: 'mailto:contact@tukio.one' },
        ]}
      />
    </div>
  );
}
