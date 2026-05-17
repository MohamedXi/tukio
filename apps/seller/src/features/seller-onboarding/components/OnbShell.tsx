'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@tukio/ui/components/Button';
import type { WizardStep } from '../wizard-state.js';

const SELLER_BASE_FALLBACK = 'http://localhost:3000';

function resolvePublicBaseUrl(): string {
  const raw = process.env['NEXT_PUBLIC_PUBLIC_BASE_URL'];
  if (raw && raw.length > 0) return raw;
  return SELLER_BASE_FALLBACK;
}

interface OnbShellProps {
  step: WizardStep;
  locale: string;
  children: React.ReactNode;
  onBack?: () => void;
  onContinue?: () => void;
  isContinueDisabled?: boolean;
  isContinueLoading?: boolean;
}

const STEP_KEYS = ['identity', 'activity', 'documents', 'review'] as const;

export function OnbShell({
  step,
  locale,
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
    <div className="flex min-h-screen flex-col bg-cream-50 text-charcoal-700">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-cream-200 bg-cream-50/90 px-6 py-4 backdrop-blur-sm sticky top-0 z-10">
        <span className="font-display text-xl font-semibold text-brand-700">{t('brandName')}</span>
        <button
          type="button"
          onClick={handleCancel}
          className="text-sm text-charcoal-500 hover:text-charcoal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
        >
          {t('continueLater')}
        </button>
      </header>

      {/* Step indicator */}
      <nav aria-label="Étapes du dossier" className="px-6 pt-6">
        <div className="mx-auto max-w-2xl">
          <div className="flex gap-2">
            {stepLabels.map((label, i) => {
              const stepNum = (i + 1) as WizardStep;
              const isDone = stepNum < step;
              const isCurrent = stepNum === step;
              return (
                <div key={label} className="flex flex-1 flex-col gap-1.5">
                  <div
                    className={`h-1 rounded-full transition-colors duration-300 ${
                      isDone ? 'bg-success-500' : isCurrent ? 'bg-brand-500' : 'bg-cream-200'
                    }`}
                    aria-hidden="true"
                  />
                  <span
                    className={`text-[11px] font-${isCurrent ? '600' : '500'} ${
                      isDone
                        ? 'text-success-700'
                        : isCurrent
                          ? 'text-brand-700'
                          : 'text-charcoal-400'
                    }`}
                  >
                    {i + 1}. {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Body */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand-600">
          {t('stepLabel', { n: step, label: stepLabels[step - 1] })}
        </p>
        {children}
      </main>

      {/* Footer */}
      <footer className="sticky bottom-0 border-t border-cream-200 bg-cream-50/90 px-6 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
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
      </footer>
    </div>
  );
}
