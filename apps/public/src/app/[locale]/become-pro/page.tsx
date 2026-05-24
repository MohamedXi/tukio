import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ locale: string }>;
}

// Permanent cross-zone redirect: apex /become-pro → seller.tukio.one/seller-coming-soon
// The pro landing lives exclusively on seller.tukio.one (Story 0.18).
// Route stays whitelisted in coming-soon-gate-decision.ts so the redirect works in pre-launch mode.
export default async function DevenirProRedirectPage({ params }: PageProps) {
  const { locale } = await params;
  const sellerBaseUrl = process.env['NEXT_PUBLIC_SELLER_BASE_URL'] ?? 'https://seller.tukio.one';
  redirect(`${sellerBaseUrl}/${locale}/seller-coming-soon`);
}
