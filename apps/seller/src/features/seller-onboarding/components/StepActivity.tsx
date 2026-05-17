'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@tukio/ui/components/Input';
import { FormField } from '@tukio/ui/components/FormField';
import { siretLuhnCheck } from '@tukio/contracts/utils/siret';
import type { LegalForm, VatStatus, Category } from '@tukio/contracts/dtos/identity/register-pro';
import type { ActivityStepValues } from '../wizard-state';

const LEGAL_FORM_OPTIONS: LegalForm[] = [
  'SAS_SASU',
  'EURL_SARL',
  'MICRO_ENTREPRISE',
  'AUTO_ENTREPRENEUR',
  'ASSO_1901',
];

const CATEGORY_OPTIONS: Category[] = [
  'tents_marquees',
  'event_furniture',
  'decoration',
  'lighting_sound',
  'catering',
  'entertainment',
];

const RADIUS_OPTIONS = [50, 80, 100, 150, 200] as const;

function isSiretFormatValid(siret: string): boolean {
  return /^\d{14}$/.test(siret) && siretLuhnCheck(siret);
}

interface StepActivityProps {
  initialValues: ActivityStepValues | null;
  onSubmit: (values: ActivityStepValues) => void;
  serverSiretError?: string;
}

export function StepActivity({ initialValues, onSubmit, serverSiretError }: StepActivityProps) {
  const t = useTranslations('seller.onboarding.activity');

  const [companyName, setCompanyName] = useState(initialValues?.companyName ?? '');
  const [siret, setSiret] = useState(initialValues?.siret ?? '');
  const [legalForm, setLegalForm] = useState<LegalForm | ''>(initialValues?.legalForm ?? '');
  const [vatStatus, setVatStatus] = useState<VatStatus | ''>(initialValues?.vatStatus ?? '');
  const [vatNumber, setVatNumber] = useState(initialValues?.vatNumber ?? '');
  const [categories, setCategories] = useState<Category[]>(initialValues?.categories ?? []);
  const [zoneCity, setZoneCity] = useState(initialValues?.serviceZone.city ?? '');
  const [zoneRadius, setZoneRadius] = useState<number>(initialValues?.serviceZone.radiusKm ?? 50);
  const [addressStreet, setAddressStreet] = useState(initialValues?.address.street ?? '');
  const [addressPostalCode, setAddressPostalCode] = useState(
    initialValues?.address.postalCode ?? '',
  );
  const [addressCity, setAddressCity] = useState(initialValues?.address.city ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const siretValid = siret.length === 14 && isSiretFormatValid(siret);
  const siretInvalid = siret.length === 14 && !isSiretFormatValid(siret);

  function toggleCategory(cat: Category) {
    setCategories((prev) => {
      if (prev.includes(cat)) return prev.filter((c) => c !== cat);
      if (prev.length >= 2) return prev;
      return [...prev, cat];
    });
  }

  function validate(): ActivityStepValues | null {
    const errs: Record<string, string> = {};
    if (!companyName.trim()) errs['companyName'] = t('errors.companyNameRequired');
    if (!siret) errs['siret'] = t('errors.siretRequired');
    else if (!isSiretFormatValid(siret)) errs['siret'] = t('errors.siretInvalid');
    if (serverSiretError) errs['siret'] = serverSiretError;
    if (!legalForm) errs['legalForm'] = t('errors.legalFormRequired');
    if (!vatStatus) errs['vatStatus'] = t('errors.vatStatusRequired');
    if (vatNumber && !/^FR[0-9A-HJ-NP-Z]{2}\d{9}$/.test(vatNumber.toUpperCase())) {
      errs['vatNumber'] = t('errors.vatNumberInvalid');
    }
    if (vatStatus === 'vat_exempt' && vatNumber) {
      errs['vatNumber'] = t('errors.vatNumberForbidden');
    }
    if (categories.length === 0) errs['categories'] = t('errors.categoriesMin');
    if (!zoneCity.trim()) errs['zoneCity'] = t('errors.serviceZoneCityRequired');
    if (!addressStreet.trim()) errs['addressStreet'] = t('errors.addressStreetRequired');
    if (!/^\d{5}$/.test(addressPostalCode))
      errs['addressPostalCode'] = t('errors.addressPostalCodeInvalid');
    if (!addressCity.trim()) errs['addressCity'] = t('errors.addressCityRequired');

    setErrors(errs);
    if (Object.keys(errs).length > 0) return null;

    return {
      companyName: companyName.trim(),
      siret: siret.trim(),
      vatNumber: vatNumber ? vatNumber.trim().toUpperCase() : undefined,
      legalForm: legalForm as LegalForm,
      vatStatus: vatStatus as VatStatus,
      categories,
      serviceZone: { city: zoneCity.trim(), radiusKm: zoneRadius },
      address: {
        street: addressStreet.trim(),
        postalCode: addressPostalCode.trim(),
        city: addressCity.trim(),
        country: 'FR',
      },
    };
  }

  function handleContinue() {
    const values = validate();
    if (values) onSubmit(values);
  }

  return (
    <div className="flex flex-col gap-6" data-testid="step-activity">
      <div>
        <h1 className="font-display text-2xl font-semibold text-charcoal-800">{t('title')}</h1>
        <p className="mt-2 text-sm text-charcoal-500">{t('subtitle')}</p>
      </div>

      <FormField
        label={t('companyName')}
        helper={t('companyNameHint')}
        required
        error={errors['companyName']}
      >
        <Input
          value={companyName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCompanyName(e.target.value)}
          placeholder={t('companyNamePlaceholder')}
          data-testid="input-companyName"
        />
      </FormField>

      <FormField
        label={t('siret')}
        helper={
          siretValid
            ? t('siretValidFormat')
            : siretInvalid
              ? t('siretInvalidFormat')
              : t('siretHint')
        }
        required
        error={errors['siret']}
      >
        <Input
          value={siret}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setSiret(e.target.value.replace(/\D/g, '').slice(0, 14))
          }
          placeholder={t('siretPlaceholder')}
          maxLength={14}
          data-testid="input-siret"
        />
      </FormField>

      <FormField label={t('legalForm')} required error={errors['legalForm']}>
        <select
          value={legalForm}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            setLegalForm(e.target.value as LegalForm)
          }
          className="h-10 w-full rounded-md border border-cream-300 bg-cream-50 px-3 text-sm text-charcoal-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          data-testid="select-legalForm"
        >
          <option value="" disabled>
            {t('legalFormPlaceholder')}
          </option>
          {LEGAL_FORM_OPTIONS.map((lf) => (
            <option key={lf} value={lf}>
              {t(`legalForms.${lf}`)}
            </option>
          ))}
        </select>
      </FormField>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-charcoal-700">
          {t('vatStatus')} <span className="text-error-500">*</span>
        </legend>
        {(['vat_registered', 'vat_exempt'] as VatStatus[]).map((vs) => (
          <label
            key={vs}
            className={`mb-2 flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
              vatStatus === vs
                ? 'border-brand-500 bg-brand-50'
                : 'border-cream-300 hover:border-cream-400'
            }`}
          >
            <input
              type="radio"
              name="vatStatus"
              value={vs}
              checked={vatStatus === vs}
              onChange={() => setVatStatus(vs)}
              className="mt-1 accent-brand-500"
              data-testid={`radio-vatStatus-${vs}`}
            />
            <span>
              <span className="block text-sm font-medium text-charcoal-700">
                {t(vs === 'vat_registered' ? 'vatRegistered' : 'vatExempt')}
              </span>
              <span className="mt-0.5 block text-xs text-charcoal-500">
                {t(vs === 'vat_registered' ? 'vatRegisteredDesc' : 'vatExemptDesc')}
              </span>
            </span>
          </label>
        ))}
        {errors['vatStatus'] && (
          <p className="mt-1 text-xs text-error-600" role="alert">
            {errors['vatStatus']}
          </p>
        )}
      </fieldset>

      {vatStatus === 'vat_registered' && (
        <FormField label={t('vatNumber')} helper={t('vatNumberHint')} error={errors['vatNumber']}>
          <Input
            value={vatNumber}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVatNumber(e.target.value)}
            placeholder={t('vatNumberPlaceholder')}
            data-testid="input-vatNumber"
          />
        </FormField>
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-charcoal-700">
          {t('categories')} <span className="text-error-500">*</span>
        </legend>
        <p className="mb-3 text-xs text-charcoal-500">{t('categoriesHint')}</p>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_OPTIONS.map((cat) => {
            const selected = categories.includes(cat);
            const maxReached = categories.length >= 2 && !selected;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => toggleCategory(cat)}
                disabled={maxReached}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                  selected
                    ? 'border-brand-500 bg-brand-500 text-cream-50'
                    : maxReached
                      ? 'cursor-not-allowed border-cream-200 bg-cream-100 text-charcoal-400'
                      : 'border-cream-300 bg-cream-50 text-charcoal-700 hover:border-brand-300 hover:bg-brand-50'
                }`}
                aria-pressed={selected}
                data-testid={`pill-category-${cat}`}
              >
                {t(`categoryList.${cat}`)}
              </button>
            );
          })}
        </div>
        {errors['categories'] && (
          <p className="mt-1 text-xs text-error-600" role="alert">
            {errors['categories']}
          </p>
        )}
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-charcoal-700">{t('serviceZone')}</legend>
        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('serviceZoneCity')} required error={errors['zoneCity']}>
            <Input
              value={zoneCity}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setZoneCity(e.target.value)}
              placeholder={t('serviceZoneCityPlaceholder')}
              data-testid="input-serviceZoneCity"
            />
          </FormField>
          <FormField label={t('serviceZoneRadius')} required>
            <select
              value={zoneRadius}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setZoneRadius(Number(e.target.value))
              }
              className="h-10 w-full rounded-md border border-cream-300 bg-cream-50 px-3 text-sm text-charcoal-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              data-testid="select-serviceZoneRadius"
            >
              {RADIUS_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {t(`serviceZoneRadiusOptions.${r}`)}
                </option>
              ))}
            </select>
          </FormField>
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-charcoal-700">{t('address')}</legend>
        <div className="flex flex-col gap-3">
          <FormField label={t('addressStreet')} required error={errors['addressStreet']}>
            <Input
              value={addressStreet}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setAddressStreet(e.target.value)
              }
              autoComplete="street-address"
              data-testid="input-addressStreet"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('addressPostalCode')} required error={errors['addressPostalCode']}>
              <Input
                value={addressPostalCode}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setAddressPostalCode(e.target.value.replace(/\D/g, '').slice(0, 5))
                }
                maxLength={5}
                autoComplete="postal-code"
                data-testid="input-addressPostalCode"
              />
            </FormField>
            <FormField label={t('addressCity')} required error={errors['addressCity']}>
              <Input
                value={addressCity}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setAddressCity(e.target.value)
                }
                autoComplete="address-level2"
                data-testid="input-addressCity"
              />
            </FormField>
          </div>
        </div>
      </fieldset>

      <button
        type="button"
        id="step-activity-continue"
        className="hidden"
        onClick={handleContinue}
        aria-hidden="true"
      />
    </div>
  );
}
