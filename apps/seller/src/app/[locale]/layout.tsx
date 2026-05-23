import type { Metadata } from 'next';
import Script from 'next/script';
import { Fraunces, Inter, JetBrains_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import './globals.css';
// AuthProvider (Keycloak.js) removed — Story 1.4d provides the cookie-based provider.

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

const SELLER_BASE_URL = process.env.NEXT_PUBLIC_SELLER_BASE_URL ?? 'https://seller.tukio.one';

export const metadata: Metadata = {
  metadataBase: new URL(SELLER_BASE_URL),
  title: {
    template: '%s — tukio.one Pro',
    default: "tukio.one Pro — Pour les pros de l'événementiel",
  },
  description:
    "Espace pro tukio.one — onboarding, fiches service, réservations pour les professionnels de l'événementiel en Pays de la Loire.",
};

const PLAUSIBLE_ENABLED = process.env.NEXT_PUBLIC_PLAUSIBLE_ENABLED === 'true';

function buildOrganizationJsonLd(locale: 'fr' | 'en'): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'tukio.one',
    alternateName: 'tukio',
    url: 'https://tukio.one',
    description:
      locale === 'fr'
        ? "Espace professionnel tukio.one pour les pros de l'événementiel."
        : 'tukio.one professional portal for event service providers.',
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
  // Seed next-intl's request scope from the URL segment so middleware
  // rewrites (Story 0.15 coming-soon gate) resolve their locale.
  setRequestLocale(locale);
  const messages = await getMessages();
  const localeNarrow = locale === 'en' ? 'en' : 'fr';
  return (
    <html
      lang={locale}
      className={`${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: buildOrganizationJsonLd(localeNarrow),
          }}
        />
        {PLAUSIBLE_ENABLED && (
          <Script
            strategy="afterInteractive"
            src="https://plausible.io/js/script.outbound-links.tagged-events.js"
            data-domain="seller.tukio.one"
          />
        )}
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
