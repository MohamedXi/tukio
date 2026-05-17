import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { ConversionProviders } from '@/features/seller-onboarding/components/ConversionProviders';
import { ProConversionWizard } from '@/features/seller-onboarding/components/ProConversionWizard';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'seller.onboarding.common' });
  return {
    title: `${t('steps.identity')} — ${t('brandName')}`,
    description: 'Démarrez votre dossier pro tukio.one',
  };
}

function readJwtClaim(token: string, claim: string): string | undefined {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) return undefined;
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
    ) as Record<string, unknown>;
    const val = payload[claim];
    return typeof val === 'string' ? val : undefined;
  } catch {
    return undefined;
  }
}

export default async function OnboardingIdentityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl && process.env.NODE_ENV === 'production') {
    throw new Error('NEXT_PUBLIC_API_URL is required in production builds.');
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('tukio-access-token')?.value;

  const prefillIdentity = token
    ? {
        firstName: readJwtClaim(token, 'given_name') ?? '',
        lastName: readJwtClaim(token, 'family_name') ?? '',
        email: readJwtClaim(token, 'email') ?? '',
      }
    : undefined;

  return (
    <ConversionProviders gatewayUrl={apiUrl ?? 'http://localhost:4000'}>
      <ProConversionWizard locale={locale} prefillIdentity={prefillIdentity} />
    </ConversionProviders>
  );
}
