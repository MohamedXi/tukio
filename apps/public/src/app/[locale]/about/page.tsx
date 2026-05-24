import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { EditorialPageShell } from '@tukio/ui/patterns/EditorialPageShell';
import { SiteHeader } from '@tukio/ui/patterns/SiteHeader';
import { Footer } from '@tukio/ui/patterns/Footer';
import { AboutContent } from '../../../features/public-pages/components/AboutContent.js';
import { LocaleSwitcherClient } from '../../../components/LocaleSwitcherClient.js';

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'about.meta' });
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
      images: [{ url: `${baseUrl}/og/about.png`, width: 1200, height: 630 }],
      url: `${baseUrl}/${locale}/about`,
    },
    twitter: { card: 'summary_large_image', title: t('title'), description: t('description') },
    alternates: {
      canonical: `${baseUrl}/${locale}/about`,
      languages: {
        fr: `${baseUrl}/fr/about`,
        en: `${baseUrl}/en/about`,
        'x-default': `${baseUrl}/fr/about`,
      },
    },
    robots: { index: true, follow: true },
  };
}

export default async function AProposPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'about' });
  const tFooter = await getTranslations({ locale, namespace: 'about.footer' });
  const sellerBaseUrl = process.env['NEXT_PUBLIC_SELLER_BASE_URL'] ?? 'https://seller.tukio.one';
  const year = new Date().getFullYear();

  return (
    <EditorialPageShell
      kicker={t('kicker')}
      title={
        <>
          {t('titleLine1')} <em className="italic text-brand-600">{t('titleEmphasis')}</em>.
        </>
      }
      intro={t('intro')}
      maxWidth={960}
      header={
        <>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:outline-none"
          >
            Aller au contenu / Skip to content
          </a>
          <SiteHeader localeSwitcher={<LocaleSwitcherClient />} />
        </>
      }
      footer={
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
      }
    >
      <div id="main-content" tabIndex={-1}>
        <AboutContent locale={locale} />
      </div>
    </EditorialPageShell>
  );
}
