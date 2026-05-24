import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { Logo } from '@tukio/ui/logo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'seller.onboarding.pending' });
  return {
    title: `${t('kicker')} · tukio`,
    description: t('title'),
  };
}

interface PendingTaskProps {
  icon: string;
  title: string;
  description: string;
}

function PendingTask({ icon, title, description }: PendingTaskProps) {
  return (
    <li className="flex items-start gap-4">
      <span className="mt-0.5 text-2xl" aria-hidden="true">
        {icon}
      </span>
      <div>
        <p className="text-sm font-semibold text-charcoal-700">{title}</p>
        <p className="mt-0.5 text-xs text-charcoal-500">{description}</p>
      </div>
    </li>
  );
}

export default async function OnboardingPendingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'seller.onboarding.pending' });

  return (
    <main className="flex min-h-screen flex-col bg-cream-50 text-charcoal-700">
      <header className="flex items-center justify-between border-b border-cream-200 px-6 py-4">
        <Logo size={22} />
        <a
          href={`/${locale}/auth/sign-out`}
          className="text-sm text-charcoal-500 hover:text-charcoal-700"
        >
          {t('signOut')}
        </a>
      </header>

      <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-6 py-12">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warning-50 text-3xl">
            ⏳
          </div>
          <p
            className="text-xs font-semibold uppercase tracking-widest text-warning-700"
            data-testid="pending-kicker"
          >
            {t('kicker')}
          </p>
          <h1 className="font-display text-2xl font-semibold leading-snug text-charcoal-800">
            {t('title')}
          </h1>
          <p className="text-sm text-charcoal-500">
            {t.rich('subtitle', {
              strong: (chunks) => (
                <strong className="font-semibold text-charcoal-700">{chunks}</strong>
              ),
            })}
          </p>
        </div>

        <div className="rounded-2xl border border-cream-200 bg-white p-6 shadow-sm">
          <p className="mb-5 text-sm font-semibold text-charcoal-700">{t('tasksTitle')}</p>
          <ul className="flex flex-col gap-5">
            <PendingTask
              icon="📋"
              title={t('tasks.listing')}
              description={t('tasks.listingDesc')}
            />
            <PendingTask icon="📸" title={t('tasks.photos')} description={t('tasks.photosDesc')} />
            <PendingTask icon="🗂️" title={t('tasks.policy')} description={t('tasks.policyDesc')} />
          </ul>
        </div>

        <p className="text-center text-sm text-charcoal-500">
          {t.rich('support', {
            email: (chunks) => (
              <a href={`mailto:${chunks}`} className="font-medium text-brand-700 hover:underline">
                {chunks}
              </a>
            ),
          })}
        </p>
      </section>

      <footer className="border-t border-cream-300 px-6 py-4 text-center text-xs text-charcoal-400">
        {t('copyright')}
      </footer>
    </main>
  );
}
