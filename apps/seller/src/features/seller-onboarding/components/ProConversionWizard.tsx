'use client';

import { useReducer, useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRegisterPro } from '@tukio/api-client/hooks/identity/use-register-pro';
import type { ApiError } from '@tukio/api-client/types/api-error';
import { useAcquisitionTracking } from '@tukio/api-client/hooks/use-acquisition-tracking';
import { isLocale } from '@tukio/i18n-client/config';
import { OnbShell } from './OnbShell.js';
import { StepIdentity } from './StepIdentity.js';
import { StepActivity } from './StepActivity.js';
import { StepDocuments } from './StepDocuments.js';
import { StepReview } from './StepReview.js';
import {
  initialWizardState,
  wizardReducer,
  type IdentityStepValues,
  type ActivityStepValues,
  type DocumentsState,
  type WizardStep,
} from '../wizard-state.js';
import { classifyConversionError } from '../services/conversion.service.js';

const SELLER_BASE_FALLBACK = 'http://localhost:3002';

function resolveSellerBaseUrl(): string {
  const raw = process.env['NEXT_PUBLIC_SELLER_BASE_URL'];
  if (raw && raw.length > 0) return raw;
  return SELLER_BASE_FALLBACK;
}

interface ProConversionWizardProps {
  locale: string;
  prefillIdentity?: Partial<IdentityStepValues>;
}

export function ProConversionWizard({ locale, prefillIdentity }: ProConversionWizardProps) {
  const resolvedLocale = isLocale(locale) ? locale : 'fr';
  const tReview = useTranslations('seller.onboarding.review');

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

  const mutation = useRegisterPro();
  const { mutate: registerPro, isPending } = mutation;
  const acquisition = useAcquisitionTracking();

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

    const input = {
      email: state.identity.email,
      firstName: state.identity.firstName,
      lastName: state.identity.lastName,
      locale: resolvedLocale,
      dateOfBirth: state.identity.dateOfBirth,
      contactPhone: state.identity.contactPhone,
      acceptMarketing: state.identity.acceptMarketing,
      companyName: state.activity.companyName,
      siret: state.activity.siret,
      vatNumber: state.activity.vatNumber,
      legalForm: state.activity.legalForm,
      vatStatus: state.activity.vatStatus,
      categories: state.activity.categories,
      serviceZone: state.activity.serviceZone,
      address: state.activity.address,
      acceptCharter: true as const,
      ...(acquisition ? { acquisition } : {}),
    };

    const files = {
      idCard: state.documents.idCard,
      rib: state.documents.rib,
      ...(state.documents.kbisOrInsee ? { kbisOrInsee: state.documents.kbisOrInsee } : {}),
    };

    registerPro(
      { input, files },
      {
        onSuccess: () => {
          mutation.reset();
          const target = `${resolveSellerBaseUrl()}/${resolvedLocale}/seller/onboarding/pending`;
          if (typeof window !== 'undefined') {
            window.location.assign(target);
          }
        },
        onError: (error: ApiError) => {
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
      isContinueLoading={isPending}
      isContinueDisabled={isPending}
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
            isSubmitting={isPending}
            bannerError={bannerError}
          />
        )}
      </div>
    </OnbShell>
  );
}
