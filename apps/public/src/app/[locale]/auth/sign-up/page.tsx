import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { SignUpForm } from '../../../../features/auth/sign-up/index.js';
import { QueryProvider, createTukioQueryClient } from '@tukio/api-client/providers';
import { ApiClientProvider } from '@tukio/api-client/providers/api-client-context';
import { createTukioApiClient } from '@tukio/api-client/client';

/**
 * Sign-up page — Server Component layout (Story 1.2d — AC1).
 *
 * SSR-rendered metadata (title, description) with next-intl server-side helpers.
 * `<SignUpForm>` is a Client Component — it holds the form state, RHF controller,
 * and TanStack Query mutation. This server boundary keeps the layout bundle
 * lean and keeps auth strings out of client JS.
 *
 * Story 0.14 (ADR-016): route at `apps/public/src/app/[locale]/auth/sign-up/` —
 * public route, NOT under `(authenticated)/` route group. No session required.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth.signup' });
  return {
    title: `${t('title')} — Tukio`,
    description: t('subtitle'),
  };
}

export default async function SignUpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth.signup' });

  const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL;
  if (!gatewayUrl) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'NEXT_PUBLIC_GATEWAY_URL is required in production builds (refusing to fall back to localhost).',
      );
    }
    console.warn('[sign-up] NEXT_PUBLIC_GATEWAY_URL not set — defaulting to http://localhost:4000');
  }
  const queryClient = createTukioQueryClient();
  const apiClient = createTukioApiClient({
    baseURL: gatewayUrl ?? 'http://localhost:4000',
  });

  return (
    <main className="min-h-screen flex items-center justify-center bg-cream-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold text-charcoal-800">{t('title')}</h1>
          <p className="mt-2 text-base text-charcoal-500">{t('subtitle')}</p>
        </div>
        <div className="bg-white rounded-lg border border-cream-200 shadow-sm p-8">
          <QueryProvider client={queryClient}>
            <ApiClientProvider client={apiClient}>
              <SignUpForm />
            </ApiClientProvider>
          </QueryProvider>
        </div>
      </div>
    </main>
  );
}
