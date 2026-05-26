import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SiteHeader } from '@tukio/ui/patterns/SiteHeader';
import { Footer } from '@tukio/ui/patterns/Footer';
import { ComingSoonSuccessHero } from '../../../../features/pre-launch/components/ComingSoonSuccessHero.js';
import { LinkedLogo } from '../../../../components/LinkedLogo.js';
import { LocaleSwitcherClient } from '../../../../components/LocaleSwitcherClient.js';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ firstName?: string; position?: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'coming_soon.meta' });
  return {
    title: t('successTitle'),
    description: t('successDescription'),
    robots: { index: false, follow: false },
  };
}

export default async function ComingSoonSuccessPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { firstName: rawFirst, position: rawPos } = await searchParams;

  const tSuccess = await getTranslations({ locale, namespace: 'coming_soon.success' });
  const tFooter = await getTranslations({ locale, namespace: 'coming_soon.footer' });
  const tHeader = await getTranslations({ locale, namespace: 'coming_soon.header' });

  const firstName = sanitizeFirstName(rawFirst, locale);
  const position = sanitizePosition(rawPos);
  const year = new Date().getFullYear();
  const sellerBaseUrl = process.env['NEXT_PUBLIC_SELLER_BASE_URL'] ?? 'https://seller.tukio.one';

  return (
    <div className="min-h-screen flex flex-col bg-cream-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:outline-none"
      >
        {tHeader('skipToForm')}
      </a>
      <SiteHeader
        logo={<LinkedLogo locale={locale} />}
        navItems={[
          { label: tSuccess('headerNavAbout'), href: `/${locale}/about` },
          {
            label: tSuccess('headerNavBecomePro'),
            href: `${sellerBaseUrl}/${locale}/seller-coming-soon`,
          },
          { label: tSuccess('headerNavContact'), href: `/${locale}/contact` },
        ]}
        localeSwitcher={<LocaleSwitcherClient />}
      />

      <ComingSoonSuccessHero locale={locale} firstName={firstName} position={position} />

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

function sanitizeFirstName(raw: string | undefined, locale: string): string {
  if (!raw) return locale === 'fr' ? 'vous' : 'you';
  // Next.js App Router already URL-decodes searchParams. No second decode required.
  return (
    raw
      .replace(/[<>'"&]/g, '')
      .trim()
      .slice(0, 80) || (locale === 'fr' ? 'vous' : 'you')
  );
}

function sanitizePosition(raw: string | undefined): number {
  const n = parseInt(raw ?? '', 10);
  if (isNaN(n) || n < 1 || n > 999_999) return 1;
  return n;
}
