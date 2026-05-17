'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { WizardState, WizardStep } from '../wizard-state';

interface ReviewCardProps {
  sectionLabel: string;
  step: WizardStep;
  onEdit: (step: WizardStep) => void;
  children: React.ReactNode;
}

function ReviewCard({ sectionLabel, step, onEdit, children }: ReviewCardProps) {
  const t = useTranslations('seller.onboarding.common');
  return (
    <div className="rounded-xl border border-cream-200 bg-cream-50 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
            {step}
          </span>
          <h3 className="text-sm font-semibold text-charcoal-700">{sectionLabel}</h3>
        </div>
        <button
          type="button"
          onClick={() => onEdit(step)}
          className="text-xs font-medium text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
        >
          {t('edit')}
        </button>
      </div>
      <dl className="flex flex-col gap-2">{children}</dl>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <dt className="shrink-0 text-charcoal-500">{label}</dt>
      <dd className="text-right text-charcoal-700">{value}</dd>
    </div>
  );
}

interface StepReviewProps {
  state: WizardState;
  onEdit: (step: WizardStep) => void;
  onSubmit: (charterAccepted: true) => void;
  isSubmitting: boolean;
  bannerError?: string;
}

export function StepReview({
  state,
  onEdit,
  onSubmit,
  isSubmitting,
  bannerError,
}: StepReviewProps) {
  const t = useTranslations('seller.onboarding.review');
  const tActivity = useTranslations('seller.onboarding.activity');
  const [charterAccepted, setCharterAccepted] = useState(false);
  const [charterError, setCharterError] = useState<string | undefined>(undefined);

  const { identity, activity, documents } = state;
  const docCount = [documents.idCard, documents.rib, documents.kbisOrInsee].filter(Boolean).length;

  function handleSubmitClick() {
    if (!charterAccepted) {
      setCharterError(t('errors.charterRequired'));
      return;
    }
    setCharterError(undefined);
    onSubmit(true);
  }

  return (
    <div className="flex flex-col gap-6" data-testid="step-review">
      <div>
        <h1 className="font-display text-2xl font-semibold text-charcoal-800">{t('title')}</h1>
        <p className="mt-2 text-sm text-charcoal-500">{t('subtitle')}</p>
      </div>

      {bannerError && (
        <div
          role="alert"
          tabIndex={-1}
          className="rounded-md border border-error-500/30 bg-error-50 p-3 text-sm leading-snug text-error-700 focus:outline-none"
        >
          {bannerError}
        </div>
      )}

      {identity && (
        <ReviewCard sectionLabel={t('sections.identity')} step={1} onEdit={onEdit}>
          <ReviewRow label={t('labels.firstName')} value={identity.firstName} />
          <ReviewRow label={t('labels.lastName')} value={identity.lastName} />
          <ReviewRow label={t('labels.email')} value={identity.email} />
          <ReviewRow label={t('labels.phone')} value={identity.contactPhone} />
          <ReviewRow label={t('labels.dateOfBirth')} value={identity.dateOfBirth} />
        </ReviewCard>
      )}

      {activity && (
        <ReviewCard sectionLabel={t('sections.activity')} step={2} onEdit={onEdit}>
          <ReviewRow label={t('labels.companyName')} value={activity.companyName} />
          <ReviewRow label={t('labels.siret')} value={activity.siret} />
          <ReviewRow
            label={t('labels.legalForm')}
            value={tActivity(`legalForms.${activity.legalForm}`)}
          />
          <ReviewRow
            label={t('labels.vatStatus')}
            value={tActivity(
              activity.vatStatus === 'vat_registered' ? 'vatRegistered' : 'vatExempt',
            )}
          />
          <ReviewRow
            label={t('labels.categories')}
            value={activity.categories.map((c) => tActivity(`categoryList.${c}`)).join(', ')}
          />
          <ReviewRow
            label={t('labels.zone')}
            value={`${activity.serviceZone.city} — ${activity.serviceZone.radiusKm} km`}
          />
        </ReviewCard>
      )}

      <ReviewCard sectionLabel={t('sections.documents')} step={3} onEdit={onEdit}>
        <ReviewRow
          label={t('labels.documents')}
          value={t('documentsUploaded', { count: docCount })}
        />
      </ReviewCard>

      <div className="rounded-xl border border-cream-200 bg-cream-50 p-5">
        <h3 className="mb-3 text-sm font-semibold text-charcoal-700">
          {t('sections.legalAgreement')}
        </h3>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-charcoal-600">
          <input
            type="checkbox"
            className="mt-0.5 accent-brand-500"
            checked={charterAccepted}
            onChange={(e) => {
              setCharterAccepted(e.target.checked);
              if (e.target.checked) setCharterError(undefined);
            }}
            data-testid="checkbox-charter"
          />
          <span>{t('charter', { charterLink: t('charterLink') })}</span>
        </label>
        {charterError && (
          <p className="mt-2 text-xs text-error-600" role="alert">
            {charterError}
          </p>
        )}
      </div>

      <button
        type="button"
        id="step-review-submit"
        className="hidden"
        onClick={handleSubmitClick}
        aria-hidden="true"
        disabled={isSubmitting}
      />
    </div>
  );
}
