import type { Metadata } from 'next';
import Script from 'next/script';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Fraunces, Inter, JetBrains_Mono } from 'next/font/google';
import { LOCALES } from '@tukio/i18n-client/config';
import { QueryProvider } from '@tukio/api-client/providers';
import { AuthProvider } from '@tukio/auth-client/provider';
import './globals.css';
// Story 1.4d AC4/AC13 — cookie/whoami-based AuthProvider (replaces the removed
// Keycloak.js provider, whose check-sso corrupted AUTH_SESSION and blocked login).
// PublicHeader consumes useAuth() from this provider to reflect the real
// post-login state.

const GATEWAY_BASE_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? 'http://localhost:4000';
const COOKIE_DOMAIN = process.env.NODE_ENV === 'production' ? '.tukio.one' : undefined;

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
    template: '%s · tukio.one',
    default: 'tukio.one · Bientôt en France',
  },
  description:
    "Marketplace française des professionnels de l'événementiel : tentes, mobilier, traiteur, décoration. Pilote 2026 en Pays de la Loire.",
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
        ? "Marketplace française des professionnels de l'événementiel : tentes, mobilier, traiteur, décoration. Pilote 2026 en Pays de la Loire."
        : 'French marketplace for event service professionals: tents, furniture, catering, decoration. 2026 pilot in Pays de la Loire.',
    foundingDate: '2026',
    foundingLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressRegion: 'Pays de la Loire',
        addressCountry: 'FR',
      },
    },
    areaServed: { '@type': 'Country', name: 'France' },
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
          <AuthProvider config={{ gatewayBaseUrl: GATEWAY_BASE_URL, cookieDomain: COOKIE_DOMAIN }}>
            <QueryProvider>{children}</QueryProvider>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
