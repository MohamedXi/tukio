'use client';
import { Button } from '../../components/Button/Button';
import type { WizardShellProps } from './WizardShell.types';

/**
 * Generic multi-step wizard layout shared between the Pro conversion wizard
 * (4 steps) and the Service-create wizard (5 steps). Provides:
 *   - sticky header (logo + draft status + "continue later")
 *   - slot for the stepper band (consumer renders <WizardStepperBand /> there)
 *   - main content column (max-w-720px) with a step kicker
 *   - inline footer with Back/Cancel + Continue/Submit
 *
 * Wizard-agnostic: knows step/totalSteps to flip first/last-step UI but
 * delegates labels and step labels to the consumer (i18n stays in the app).
 */
export function WizardShell({
  step,
  totalSteps,
  logo,
  band,
  children,
  onBack,
  onContinue,
  onCancel,
  isContinueDisabled = false,
  isContinueLoading = false,
  labels,
}: WizardShellProps) {
  const isFirstStep = step === 1;
  const isLastStep = step === totalSteps;

  return (
    <div className="min-h-screen bg-cream-50 text-charcoal-700">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-cream-200 bg-cream-50/90 px-6 py-5 backdrop-blur-sm sm:px-10">
        {logo}
        {labels.draftSaved && (
          <span className="hidden text-xs text-charcoal-400 sm:block">{labels.draftSaved}</span>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-charcoal-500 hover:text-charcoal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
        >
          {labels.continueLater}
        </button>
      </header>

      {band}

      <div className="mx-auto max-w-[720px] px-6 pb-16 pt-10 sm:px-10">
        {labels.stepLabel && (
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand-600">
            {labels.stepLabel}
          </p>
        )}

        {children}

        <div className="mt-12 flex items-center justify-between border-t border-cream-200 pt-6">
          {isFirstStep ? (
            <Button variant="secondary" size="sm" type="button" onClick={onCancel}>
              {labels.cancel}
            </Button>
          ) : (
            <Button variant="secondary" size="sm" type="button" onClick={onBack}>
              ← {labels.back}
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
            {isLastStep ? labels.submit : `${labels.continue} →`}
          </Button>
        </div>
      </div>
    </div>
  );
}

WizardShell.displayName = 'WizardShell';
