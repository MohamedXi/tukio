import type { Metadata } from 'next';
import { Fraunces, Inter, JetBrains_Mono } from 'next/font/google';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { LOCALES } from '@tukio/i18n-client/config';
import { AuthProvider } from '@tukio/auth-client/provider';
import './globals.css';
// Story 1.4d: Keycloak.js removed; cookie-based AuthProvider wired here so that
// admin components (e.g. LogoutButton) can consume useAuth() / useLogout().

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

const GATEWAY_BASE_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? 'http://localhost:4000';
const COOKIE_DOMAIN = process.env.NODE_ENV === 'production' ? '.tukio.one' : undefined;

export const metadata: Metadata = {
  title: 'Tukio · Admin',
  description: 'Tukio admin console (Story 0.1 placeholder).',
};

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(LOCALES, locale)) {
    notFound();
  }
  // Seed next-intl's request scope from the URL segment (required for static
  // rendering + middleware-rewritten requests to resolve locale correctly).
  setRequestLocale(locale);
  const messages = await getMessages();
  return (
    <html
      lang={locale}
      className={`${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <NextIntlClientProvider messages={messages}>
          <AuthProvider config={{ gatewayBaseUrl: GATEWAY_BASE_URL, cookieDomain: COOKIE_DOMAIN }}>
            {children}
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
