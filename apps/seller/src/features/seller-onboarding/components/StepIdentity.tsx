'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@tukio/ui/components/Input';
import { FormField } from '@tukio/ui/components/FormField';
import type { IdentityStepValues } from '../wizard-state';

const PHONE_REGEX = /^(?:\+33|0)[1-9]\d{8}$/;
const DOB_DISPLAY_REGEX = /^\d{2}\/\d{2}\/\d{4}$/;

function parseDobDisplay(display: string): string | null {
  if (!DOB_DISPLAY_REGEX.test(display)) return null;
  const [dd, mm, yyyy] = display.split('/');
  return `${yyyy}-${mm}-${dd}`;
}

function formatDobDisplay(iso: string): string {
  if (!iso) return '';
  const [yyyy, mm, dd] = iso.split('-');
  return `${dd}/${mm}/${yyyy}`;
}

function validateAge(isoDate: string): boolean {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  const today = new Date();
  let age = today.getUTCFullYear() - y;
  const monthDelta = today.getUTCMonth() + 1 - m;
  if (monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < d)) age -= 1;
  return age >= 18;
}

interface StepIdentityProps {
  initialValues: IdentityStepValues | null;
  onSubmit: (values: IdentityStepValues) => void;
}

export function StepIdentity({ initialValues, onSubmit }: StepIdentityProps) {
  const t = useTranslations('seller.onboarding.identity');
  const tCommon = useTranslations('seller.onboarding.common');

  const [firstName, setFirstName] = useState(initialValues?.firstName ?? '');
  const [lastName, setLastName] = useState(initialValues?.lastName ?? '');
  const [email, setEmail] = useState(initialValues?.email ?? '');
  const [phone, setPhone] = useState(initialValues?.contactPhone ?? '');
  const [dobDisplay, setDobDisplay] = useState(
    initialValues?.dateOfBirth ? formatDobDisplay(initialValues.dateOfBirth) : '',
  );
  const [acceptMarketing, setAcceptMarketing] = useState(initialValues?.acceptMarketing ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): IdentityStepValues | null {
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs['firstName'] = t('errors.firstNameRequired');
    if (!lastName.trim()) errs['lastName'] = t('errors.lastNameRequired');
    if (!email.trim()) errs['email'] = t('errors.emailRequired');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs['email'] = t('errors.emailInvalid');
    if (!phone.trim()) errs['phone'] = t('errors.phoneRequired');
    else if (!PHONE_REGEX.test(phone)) errs['phone'] = t('errors.phoneInvalid');

    const isoDate = parseDobDisplay(dobDisplay);
    if (!dobDisplay.trim()) {
      errs['dateOfBirth'] = t('errors.dobRequired');
    } else if (!isoDate) {
      errs['dateOfBirth'] = t('errors.dobInvalid');
    } else {
      const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
      const parsed = new Date(Date.UTC(y, m - 1, d));
      if (parsed > new Date()) {
        errs['dateOfBirth'] = t('errors.dobFuture');
      } else if (!validateAge(isoDate)) {
        errs['dateOfBirth'] = t('errors.dobTooYoung');
      }
    }

    setErrors(errs);
    if (Object.keys(errs).length > 0) return null;

    return {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      contactPhone: phone.trim(),
      dateOfBirth: isoDate!,
      acceptMarketing,
    };
  }

  function handleContinue() {
    const values = validate();
    if (values) onSubmit(values);
  }

  return (
    <div className="flex flex-col gap-6" data-testid="step-identity">
      <div>
        <h1 className="font-display text-2xl font-semibold text-charcoal-800">{t('title')}</h1>
        <p className="mt-2 text-sm text-charcoal-500">{t('subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label={t('firstName')} required error={errors['firstName']}>
          <Input
            value={firstName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFirstName(e.target.value)}
            autoComplete="given-name"
            data-testid="input-firstName"
          />
        </FormField>
        <FormField label={t('lastName')} required error={errors['lastName']}>
          <Input
            value={lastName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLastName(e.target.value)}
            autoComplete="family-name"
            data-testid="input-lastName"
          />
        </FormField>
      </div>

      <FormField label={t('email')} helper={t('emailHint')} required error={errors['email']}>
        <Input
          type="email"
          value={email}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
          autoComplete="email"
          data-testid="input-email"
        />
      </FormField>

      <FormField label={t('phone')} helper={t('phoneHint')} required error={errors['phone']}>
        <Input
          type="tel"
          value={phone}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
          placeholder={t('phonePlaceholder')}
          autoComplete="tel"
          data-testid="input-phone"
        />
      </FormField>

      <FormField
        label={t('dateOfBirth')}
        helper={t('dateOfBirthHint')}
        required
        error={errors['dateOfBirth']}
      >
        <Input
          type="text"
          value={dobDisplay}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDobDisplay(e.target.value)}
          placeholder={t('dateOfBirthPlaceholder')}
          data-testid="input-dateOfBirth"
        />
      </FormField>

      <label className="flex cursor-pointer items-start gap-3 text-sm text-charcoal-600">
        <input
          type="checkbox"
          className="mt-0.5 accent-brand-500"
          checked={acceptMarketing}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setAcceptMarketing(e.target.checked)
          }
          data-testid="checkbox-acceptMarketing"
        />
        <span>{t('acceptMarketing')}</span>
      </label>

      {/* RGPD banner */}
      <div className="flex items-start gap-3 rounded-lg border border-brand-100 bg-brand-50 px-4 py-3">
        <span aria-label={tCommon('rgpdAlt')} className="mt-0.5 text-lg">
          🛡️
        </span>
        <p className="text-xs leading-relaxed text-brand-700">{tCommon('rgpd')}</p>
      </div>

      {/* Hidden submit trigger — OnbShell footer button calls handleContinue via ref alternative */}
      <button
        type="button"
        id="step-identity-continue"
        className="hidden"
        onClick={handleContinue}
        aria-hidden="true"
      />
    </div>
  );
}
