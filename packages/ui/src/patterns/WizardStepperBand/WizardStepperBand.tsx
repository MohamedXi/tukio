'use client';
import { cn } from '../../utils/cn';
import { StepIndicator } from '../StepIndicator/StepIndicator';
import type { WizardStepperBandProps } from './WizardStepperBand.types';

/**
 * Full-width header band that lives between the wizard header and main content.
 * Renders a counter label ("Step N of M …") above a horizontal `StepIndicator`,
 * with a max content width of 880px to match the Cloud Design system spec.
 *
 * Wizard-agnostic — used by the Pro conversion wizard, the Service-create
 * wizard (V1) and any future multi-step flow.
 */
export function WizardStepperBand({
  steps,
  current,
  counterLabel,
  className,
}: WizardStepperBandProps) {
  return (
    <div className={cn('border-b border-cream-200 px-6 pb-4 pt-8 sm:px-10', className)}>
      <div className="mx-auto max-w-[880px]">
        <p className="mb-4 text-xs text-charcoal-500">{counterLabel}</p>
        <StepIndicator steps={steps} current={current} />
      </div>
    </div>
  );
}

WizardStepperBand.displayName = 'WizardStepperBand';
