import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SiteHeader } from '@tukio/ui/patterns/SiteHeader';
import { Footer } from '@tukio/ui/patterns/Footer';
import { ContactPageShell } from '../../../features/public-pages/components/ContactPageShell.js';

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'contact.meta' });
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
      images: [{ url: `${baseUrl}/og/contact.png`, width: 1200, height: 630 }],
      url: `${baseUrl}/${locale}/contact`,
    },
    twitter: { card: 'summary_large_image', title: t('title'), description: t('description') },
    alternates: {
      canonical: `${baseUrl}/${locale}/contact`,
      languages: {
        fr: `${baseUrl}/fr/contact`,
        en: `${baseUrl}/en/contact`,
        'x-default': `${baseUrl}/fr/contact`,
      },
    },
    robots: { index: true, follow: true },
  };
}

export default async function ContactPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tFooter = await getTranslations({ locale, namespace: 'contact.footer' });
  const sellerBaseUrl = process.env['NEXT_PUBLIC_SELLER_BASE_URL'] ?? 'https://seller.tukio.one';
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen flex flex-col bg-cream-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:outline-none"
      >
        Aller au contenu / Skip to content
      </a>
      <SiteHeader />
      <main className="flex-1" id="main-content">
        <ContactPageShell locale={locale} />
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
