import type { Metadata } from 'next';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Fraunces, Inter, JetBrains_Mono } from 'next/font/google';
import { LOCALES } from '@tukio/i18n-client/config';
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
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
