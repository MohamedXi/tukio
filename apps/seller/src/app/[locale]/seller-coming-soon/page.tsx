import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SiteHeader } from '@tukio/ui/patterns/SiteHeader';
import { Footer } from '@tukio/ui/patterns/Footer';
import { LocaleSwitcherClient } from '../../../components/LocaleSwitcherClient';
import { SellerComingSoonHero } from '../../../features/pre-launch/components/SellerComingSoonHero';
import { SellerComingSoonProfessions } from '../../../features/pre-launch/components/SellerComingSoonProfessions';
import { SellerComingSoonJourney } from '../../../features/pre-launch/components/SellerComingSoonJourney';
import { SellerComingSoonRequirements } from '../../../features/pre-launch/components/SellerComingSoonRequirements';
import { SellerComingSoonPayments } from '../../../features/pre-launch/components/SellerComingSoonPayments';
import { SellerComingSoonPricing } from '../../../features/pre-launch/components/SellerComingSoonPricing';
import { SellerComingSoonBenefits } from '../../../features/pre-launch/components/SellerComingSoonBenefits';
import { SellerComingSoonFinalCta } from '../../../features/pre-launch/components/SellerComingSoonFinalCta';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'seller_coming_soon.meta' });
  const sellerBaseUrl = process.env['NEXT_PUBLIC_SELLER_BASE_URL'] ?? 'https://seller.tukio.one';

  return {
    title: t('title'),
    description: t('description'),
    openGraph: {
      title: t('title'),
      description: t('description'),
      type: 'website',
      locale: locale === 'fr' ? 'fr_FR' : 'en_US',
      siteName: 'tukio.one · Pros',
      images: [
        {
          url: `${sellerBaseUrl}/og/seller-coming-soon.png`,
          width: 1200,
          height: 630,
          alt: t('title'),
        },
      ],
      url: `${sellerBaseUrl}/${locale}/seller-coming-soon`,
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('description'),
      images: [`${sellerBaseUrl}/og/seller-coming-soon.png`],
    },
    alternates: {
      canonical: `${sellerBaseUrl}/${locale}/seller-coming-soon`,
      languages: {
        fr: `${sellerBaseUrl}/fr/seller-coming-soon`,
        en: `${sellerBaseUrl}/en/seller-coming-soon`,
        'x-default': `${sellerBaseUrl}/fr/seller-coming-soon`,
      },
    },
    robots: { index: true, follow: true },
  };
}

export default async function SellerComingSoonPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'seller_coming_soon' });
  const tFooter = await getTranslations({ locale, namespace: 'seller_coming_soon.footer' });
  const year = new Date().getFullYear();
  const apexBaseUrl = process.env['NEXT_PUBLIC_PUBLIC_BASE_URL'] ?? 'https://tukio.one';

  return (
    <div className="min-h-screen flex flex-col bg-cream-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:outline-none"
      >
        {t('skipToContent')}
      </a>

      <SiteHeader localeSwitcher={<LocaleSwitcherClient />} />

      <main id="main-content" className="flex-1">
        <SellerComingSoonHero locale={locale} />
        <SellerComingSoonProfessions locale={locale} />
        <SellerComingSoonJourney locale={locale} />
        <SellerComingSoonRequirements locale={locale} />
        <SellerComingSoonPayments locale={locale} />
        <SellerComingSoonPricing locale={locale} />
        <SellerComingSoonBenefits locale={locale} />
        <SellerComingSoonFinalCta locale={locale} />
      </main>

      <Footer
        variant="minimal"
        legal={tFooter('legal', { year })}
        inlineLinks={[
          { label: tFooter('linkLegalNotice'), href: `${apexBaseUrl}/${locale}/legal` },
          { label: tFooter('linkContactEmail'), href: 'mailto:contact@tukio.one' },
        ]}
      />
    </div>
  );
}
