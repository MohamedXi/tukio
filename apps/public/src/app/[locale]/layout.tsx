import type { Metadata } from 'next';
import Script from 'next/script';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Fraunces, Inter, JetBrains_Mono } from 'next/font/google';
import { LOCALES } from '@tukio/i18n-client/config';
import { QueryProvider } from '@tukio/api-client/providers';
import './globals.css';
// AuthProvider (Keycloak.js) intentionnellement retiré — Story 1.4d le remplace
// par un provider cookie-based (tukio-session-active + /v1/auth/whoami).
// Le Keycloak.js check-sso créait des AUTH_SESSION corrompues qui bloquaient le login.

const fraunces = Fraunces({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  axes: ['opsz', 'SOFT', 'WONK'],
  style: ['normal', 'italic'],
  weight: 'variable',
  variable: '--font-fraunces',
});

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-inter',
  preload: true,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600'],
  variable: '--font-jetbrains-mono',
});

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://tukio.one';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    template: '%s — tukio.one',
    default: 'tukio.one — Bientôt en Pays de la Loire',
  },
  description:
    "Marketplace des professionnels de l'événementiel en Pays de la Loire — tentes, mobilier, traiteur, décoration.",
};

const PLAUSIBLE_SCRIPT_URL = process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL;

function buildOrganizationJsonLd(locale: 'fr' | 'en'): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'tukio.one',
    alternateName: 'tukio',
    url: 'https://tukio.one',
    description:
      locale === 'fr'
        ? "Marketplace des professionnels de l'événementiel en Pays de la Loire — tentes, mobilier, traiteur, décoration."
        : 'Marketplace for event service professionals in Pays de la Loire — tents, furniture, catering, decoration.',
    foundingDate: '2026',
    foundingLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressRegion: 'Pays de la Loire',
        addressCountry: 'FR',
      },
    },
    areaServed: { '@type': 'AdministrativeArea', name: 'Pays de la Loire' },
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'contact@tukio.one',
      contactType: 'Customer Service',
      availableLanguage: ['French', 'English'],
    },
  });
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  // Defensive: middleware makes unknown locales unreachable in normal flow,
  // but a hardcoded URL like /xx/ would still hit this layout.
  if (!hasLocale(LOCALES, locale)) {
    notFound();
  }
  // Explicitly seed next-intl's request scope from the URL segment so
  // requests rewritten by middleware (e.g. Story 0.15 coming-soon gate)
  // resolve their locale without depending on a pass through next-intl's
  // own middleware. Idempotent with the normal middleware-driven flow.
  setRequestLocale(locale);
  const messages = await getMessages();
  return (
    <html
      lang={locale}
      className={`${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        {PLAUSIBLE_SCRIPT_URL && (
          <>
            <Script strategy="beforeInteractive" src={PLAUSIBLE_SCRIPT_URL} />
            <Script
              id="plausible-init"
              strategy="beforeInteractive"
              dangerouslySetInnerHTML={{
                __html: `window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init()`,
              }}
            />
          </>
        )}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: buildOrganizationJsonLd(locale) }}
        />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <QueryProvider>{children}</QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
