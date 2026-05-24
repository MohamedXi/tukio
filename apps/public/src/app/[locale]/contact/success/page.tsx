import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SiteHeader } from '@tukio/ui/patterns/SiteHeader';
import { Footer } from '@tukio/ui/patterns/Footer';
import { ContactSuccessHero } from '../../../../features/public-pages/components/ContactSuccessHero.js';
import { LocaleSwitcherClient } from '../../../../components/LocaleSwitcherClient.js';

const SUBJECT_KEYS = ['general', 'devenirPro', 'technique', 'partenariat', 'presse'] as const;
type SubjectKey = (typeof SUBJECT_KEYS)[number];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    firstName?: string;
    email?: string;
    subject?: string;
    time?: string;
  }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'contact.meta' });
  return {
    title: t('successTitle'),
    description: t('successDescription'),
    robots: { index: false, follow: false },
  };
}

export default async function ContactSuccessPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const raw = await searchParams;

  const firstName = sanitizeFirstName(raw.firstName, locale);
  const email = sanitizeEmail(raw.email, locale);
  const subject = sanitizeSubject(raw.subject);
  const submittedAt = sanitizeTime(raw.time);

  const tFooter = await getTranslations({ locale, namespace: 'contact.footer' });
  const sellerBaseUrl = process.env['NEXT_PUBLIC_SELLER_BASE_URL'] ?? 'https://seller.tukio.one';
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen flex flex-col bg-cream-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:outline-none"
      >
        {locale === 'fr' ? 'Aller au contenu' : 'Skip to content'}
      </a>
      <SiteHeader localeSwitcher={<LocaleSwitcherClient />} />

      <ContactSuccessHero
        locale={locale}
        firstName={firstName}
        email={email}
        subject={subject}
        submittedAt={submittedAt}
      />

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
  const fallback = locale === 'fr' ? 'vous' : 'you';
  if (!raw) return fallback;
  return (
    raw
      .replace(/[<>'"&]/g, '')
      .trim()
      .slice(0, 80) || fallback
  );
}

function sanitizeEmail(raw: string | undefined, locale: string): string {
  if (!raw) return locale === 'fr' ? 'votre adresse' : 'your address';
  const trimmed = raw.trim().slice(0, 254);
  return EMAIL_RE.test(trimmed) ? trimmed : locale === 'fr' ? 'votre adresse' : 'your address';
}

function sanitizeSubject(raw: string | undefined): SubjectKey {
  return SUBJECT_KEYS.includes(raw as SubjectKey) ? (raw as SubjectKey) : 'general';
}

function sanitizeTime(raw: string | undefined): Date {
  const now = new Date();
  if (!raw) return now;
  const parsed = new Date(raw);
  if (isNaN(parsed.getTime())) return now;
  const drift = Math.abs(parsed.getTime() - now.getTime());
  return drift > MAX_AGE_MS ? now : parsed;
}
