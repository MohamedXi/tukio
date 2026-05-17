'use client';

import { useReducer, useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { OnbShell } from './OnbShell';
import { StepIdentity } from './StepIdentity';
import { StepActivity } from './StepActivity';
import { StepDocuments } from './StepDocuments';
import { StepReview } from './StepReview';
import {
  initialWizardState,
  wizardReducer,
  type IdentityStepValues,
  type ActivityStepValues,
  type DocumentsState,
  type WizardStep,
} from '../wizard-state';
import { classifyConversionError } from '../services/conversion.service';
import { useRegisterProMutation } from '../hooks/use-register-pro-mutation';

const SELLER_BASE_FALLBACK = 'http://localhost:3002';

function resolveSellerBaseUrl(): string {
  const raw = process.env['NEXT_PUBLIC_SELLER_BASE_URL'];
  if (raw && raw.length > 0) return raw;
  return SELLER_BASE_FALLBACK;
}

function resolveLocale(locale: string): 'fr' | 'en' {
  return locale === 'en' ? 'en' : 'fr';
}

interface ProConversionWizardProps {
  locale: string;
  prefillIdentity?: Partial<IdentityStepValues>;
}

export function ProConversionWizard({ locale, prefillIdentity }: ProConversionWizardProps) {
  const resolvedLocale = resolveLocale(locale);
  const tReview = useTranslations('seller.onboarding.review');
  const mutation = useRegisterProMutation();

  const [state, dispatch] = useReducer(wizardReducer, {
    ...initialWizardState,
    identity: prefillIdentity
      ? {
          firstName: prefillIdentity.firstName ?? '',
          lastName: prefillIdentity.lastName ?? '',
          email: prefillIdentity.email ?? '',
          contactPhone: prefillIdentity.contactPhone ?? '',
          dateOfBirth: prefillIdentity.dateOfBirth ?? '',
          acceptMarketing: prefillIdentity.acceptMarketing ?? false,
        }
      : null,
  });

  const [bannerError, setBannerError] = useState<string | undefined>(undefined);
  const [siretServerError, setSiretServerError] = useState<string | undefined>(undefined);
  const [documentsErrors, setDocumentsErrors] = useState<Record<string, string>>({});

  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bannerError && bannerRef.current) {
      bannerRef.current.focus();
    }
  }, [bannerError]);

  function handleIdentitySubmit(values: IdentityStepValues) {
    setBannerError(undefined);
    dispatch({ type: 'SAVE_IDENTITY', payload: values });
  }

  function handleActivitySubmit(values: ActivityStepValues) {
    setBannerError(undefined);
    setSiretServerError(undefined);
    dispatch({ type: 'SAVE_ACTIVITY', payload: values });
  }

  function handleDocumentChange(field: keyof DocumentsState, file: File | null) {
    dispatch({ type: 'SET_DOCUMENT', field, file });
  }

  function handleBack() {
    setBannerError(undefined);
    dispatch({ type: 'GO_BACK' });
  }

  function handleEditStep(step: WizardStep) {
    dispatch({ type: 'GO_TO', step });
  }

  function validateDocuments(): boolean {
    const errs: Record<string, string> = {};
    if (!state.documents.idCard) errs['idCard'] = tReview('errors.generic');
    if (!state.documents.rib) errs['rib'] = tReview('errors.generic');
    setDocumentsErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleContinue() {
    if (state.currentStep === 1) {
      document.getElementById('step-identity-continue')?.click();
    } else if (state.currentStep === 2) {
      document.getElementById('step-activity-continue')?.click();
    } else if (state.currentStep === 3) {
      if (!validateDocuments()) return;
      dispatch({ type: 'GO_TO', step: 4 });
    } else if (state.currentStep === 4) {
      document.getElementById('step-review-submit')?.click();
    }
  }

  function handleFinalSubmit() {
    if (!state.identity || !state.activity || !state.documents.idCard || !state.documents.rib) {
      dispatch({ type: 'GO_TO', step: state.identity ? (state.activity ? 3 : 2) : 1 });
      return;
    }
    setBannerError(undefined);
    setSiretServerError(undefined);

    mutation.mutate(
      { state, locale: resolvedLocale },
      {
        onSuccess: () => {
          mutation.reset();
          const target = `${resolveSellerBaseUrl()}/${resolvedLocale}/seller/onboarding/pending`;
          if (typeof window !== 'undefined') {
            window.location.assign(target);
          }
        },
        onError: (error) => {
          mutation.reset();
          const failure = classifyConversionError(error);
          switch (failure.kind) {
            case 'rate_limited':
              setBannerError(
                tReview('errors.rateLimit', { seconds: failure.retryAfterSeconds ?? 60 }),
              );
              break;
            case 'siret_conflict':
              setSiretServerError(tReview('errors.conflictSiret'));
              dispatch({ type: 'GO_TO', step: 2 });
              break;
            case 'siret_inactive':
              setSiretServerError(tReview('errors.inactiveInsee'));
              dispatch({ type: 'GO_TO', step: 2 });
              break;
            case 'external':
              setBannerError(tReview('errors.external'));
              break;
            case 'network':
              setBannerError(tReview('errors.network'));
              break;
            default:
              setBannerError(tReview('errors.generic'));
              break;
          }
        },
      },
    );
  }

  return (
    <OnbShell
      step={state.currentStep}
      locale={locale}
      onBack={state.currentStep > 1 ? handleBack : undefined}
      onContinue={handleContinue}
      isContinueLoading={mutation.isPending}
      isContinueDisabled={mutation.isPending}
    >
      <div ref={bannerRef} tabIndex={-1} style={{ outline: 'none' }}>
        {state.currentStep === 1 && (
          <StepIdentity initialValues={state.identity} onSubmit={handleIdentitySubmit} />
        )}
        {state.currentStep === 2 && (
          <StepActivity
            initialValues={state.activity}
            onSubmit={handleActivitySubmit}
            serverSiretError={siretServerError}
          />
        )}
        {state.currentStep === 3 && (
          <StepDocuments
            values={state.documents}
            errors={documentsErrors}
            onChange={handleDocumentChange}
          />
        )}
        {state.currentStep === 4 && (
          <StepReview
            state={state}
            onEdit={handleEditStep}
            onSubmit={handleFinalSubmit}
            isSubmitting={mutation.isPending}
            bannerError={bannerError}
          />
        )}
      </div>
    </OnbShell>
  );
}
