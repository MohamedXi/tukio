import type { Metadata } from 'next';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Fraunces, Inter, JetBrains_Mono } from 'next/font/google';
import { LOCALES } from '@tukio/i18n-client/config';
import { AuthProvider } from '@tukio/auth-client/provider';
import './globals.css';

function getKeycloakConfig() {
  const url = process.env['NEXT_PUBLIC_KEYCLOAK_URL'];
  if (!url && process.env.NODE_ENV === 'production') {
    throw new Error('NEXT_PUBLIC_KEYCLOAK_URL is required in production builds.');
  }
  return {
    url: url ?? 'http://localhost:9010',
    realm: process.env['NEXT_PUBLIC_KEYCLOAK_REALM'] ?? 'tukio',
    clientId: process.env['NEXT_PUBLIC_KEYCLOAK_CLIENT_ID'] ?? 'tukio-web',
  };
}

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

export const metadata: Metadata = {
  title: 'Tukio — Public',
  description: 'Tukio public web (Sprint 0 placeholder).',
};

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
  const messages = await getMessages();
  return (
    <html
      lang={locale}
      className={`${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AuthProvider config={getKeycloakConfig()}>{children}</AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
