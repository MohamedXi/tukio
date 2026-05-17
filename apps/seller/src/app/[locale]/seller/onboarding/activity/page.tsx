import { redirect } from 'next/navigation';

export default async function OnboardingActivityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/seller/onboarding/identity`);
}
