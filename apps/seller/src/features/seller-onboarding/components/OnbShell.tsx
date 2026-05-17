'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@tukio/ui/components/Button';
import { Logo } from '@tukio/ui/patterns/Logo';
import type { WizardStep } from '../wizard-state';

const SELLER_BASE_FALLBACK = 'http://localhost:3000';

function resolvePublicBaseUrl(): string {
  const raw = process.env['NEXT_PUBLIC_PUBLIC_BASE_URL'];
  if (raw && raw.length > 0) return raw;
  return SELLER_BASE_FALLBACK;
}

const STEP_KEYS = ['identity', 'activity', 'documents', 'review'] as const;

interface OnbShellProps {
  step: WizardStep;
  locale: string;
  band: React.ReactNode;
  children: React.ReactNode;
  onBack?: () => void;
  onContinue?: () => void;
  isContinueDisabled?: boolean;
  isContinueLoading?: boolean;
}

export function OnbShell({
  step,
  locale,
  band,
  children,
  onBack,
  onContinue,
  isContinueDisabled = false,
  isContinueLoading = false,
}: OnbShellProps) {
  const t = useTranslations('seller.onboarding.common');
  const stepLabels = STEP_KEYS.map((k) => t(`steps.${k}`));
  const isFirstStep = step === 1;
  const isLastStep = step === 4;

  function handleCancel() {
    const target = `${resolvePublicBaseUrl()}/${locale}/account/dashboard`;
    if (typeof window !== 'undefined') {
      window.location.assign(target);
    }
  }

  return (
    <div className="min-h-screen bg-cream-50 text-charcoal-700">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-cream-200 bg-cream-50/90 px-6 py-5 backdrop-blur-sm sm:px-10">
        <Logo size={22} />
        <span className="hidden text-xs text-charcoal-400 sm:block">
          {t('draftSaved', { n: 1 })}
        </span>
        <button
          type="button"
          onClick={handleCancel}
          className="text-sm text-charcoal-500 hover:text-charcoal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
        >
          {t('continueLater')}
        </button>
      </header>

      {/* Stepper band — injected from the page */}
      {band}

      {/* Main content */}
      <div className="mx-auto max-w-[720px] px-6 pb-16 pt-10 sm:px-10">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand-600">
          {t('stepLabel', { n: step, label: stepLabels[step - 1] })}
        </p>

        {children}

        {/* Inline nav footer */}
        <div className="mt-12 flex items-center justify-between border-t border-cream-200 pt-6">
          {isFirstStep ? (
            <Button variant="secondary" size="sm" type="button" onClick={handleCancel}>
              {t('cancel')}
            </Button>
          ) : (
            <Button variant="secondary" size="sm" type="button" onClick={onBack}>
              ← {t('back')}
            </Button>
          )}
          <Button
            variant="primary"
            size="default"
            type="button"
            onClick={onContinue}
            disabled={isContinueDisabled}
            aria-busy={isContinueLoading}
          >
            {isLastStep ? t('submit') : `${t('continue')} →`}
          </Button>
        </div>
      </div>
    </div>
  );
}
