'use client';

import { useTranslations } from 'next-intl';
import { StepIndicator } from '@tukio/ui/patterns/StepIndicator';
import type { WizardStep } from '../wizard-state';

const STEP_KEYS = ['identity', 'activity', 'documents', 'review'] as const;

interface OnbStepperBandProps {
  step: WizardStep;
}

export function OnbStepperBand({ step }: OnbStepperBandProps) {
  const t = useTranslations('seller.onboarding.common');
  const stepLabels = STEP_KEYS.map((k) => t(`steps.${k}`));

  return (
    <div className="border-b border-cream-200 px-6 pb-4 pt-8 sm:px-10">
      <div className="mx-auto max-w-[880px]">
        <p className="mb-4 text-xs text-charcoal-500">
          {t('stepCounter', { n: step, total: STEP_KEYS.length })}
        </p>
        <StepIndicator steps={stepLabels} current={step - 1} />
      </div>
    </div>
  );
}
