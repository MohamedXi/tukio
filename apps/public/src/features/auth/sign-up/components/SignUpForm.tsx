'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm, Controller, type Resolver } from 'react-hook-form';
import * as RadixCheckbox from '@radix-ui/react-checkbox';
import { CheckIcon } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { isLocale } from '@tukio/i18n-client/config';
import {
  RegisterCustomerInputSchema,
  type RegisterCustomerInputDto,
} from '@tukio/contracts/dtos/identity/register-customer';
import { useRegisterCustomer } from '@tukio/api-client/hooks/identity';
import { useAcquisitionTracking } from '@tukio/api-client/hooks/use-acquisition-tracking';
import { FormField } from '@tukio/ui/form-field';
import { Input } from '@tukio/ui/input';
import { Button } from '@tukio/ui/button';
import { classifySignUpError } from '../services/sign-up.service.js';

const FormSchema = RegisterCustomerInputSchema.omit({ locale: true });
type FormValues = Omit<RegisterCustomerInputDto, 'locale'>;

type FieldKey = keyof FormValues;

// Maps a Zod issue (stable code + path + raw message) to an i18n key under
// `auth.signup.errors.*`. Uses `issue.code` first; falls back to message
// keyword matching ONLY for password regex variants (we control those messages
// in `register-customer.dto.ts`, so the keywords are stable).
function zodIssueToI18nKey(path: FieldKey | string, code: string, message: string): string {
  if (path === 'email') {
    if (code === 'too_big') return 'emailTooLong';
    return 'emailInvalid';
  }
  if (path === 'password') {
    if (code === 'too_small') return 'passwordTooShort';
    if (code === 'too_big') return 'passwordTooLong';
    const lower = message.toLowerCase();
    if (lower.includes('lowercase')) return 'passwordNeedsLowercase';
    if (lower.includes('uppercase')) return 'passwordNeedsUppercase';
    if (lower.includes('digit')) return 'passwordNeedsDigit';
    if (lower.includes('special')) return 'passwordNeedsSpecial';
    return 'passwordInvalid';
  }
  if (path === 'firstName') {
    if (code === 'too_big') return 'firstNameTooLong';
    return 'firstNameRequired';
  }
  if (path === 'lastName') {
    if (code === 'too_big') return 'lastNameTooLong';
    return 'lastNameRequired';
  }
  if (path === 'acceptTerms') return 'acceptTermsRequired';
  return 'unknown';
}

// RHF resolver that runs Zod and stores the i18n key in `error.message`
// (the SignUpForm only does `t(errors.field.message)` — no string matching).
const zodV4Resolver: Resolver<FormValues> = async (values) => {
  const result = FormSchema.safeParse(values);
  if (result.success) return { values: result.data, errors: {} };
  const errors: Record<string, { type: string; message: string }> = {};
  for (const issue of result.error.issues) {
    const head = issue.path[0];
    const path = typeof head === 'string' ? head : String(head ?? '');
    if (!path || errors[path]) continue;
    errors[path] = {
      type: issue.code,
      message: zodIssueToI18nKey(path, issue.code, issue.message),
    };
  }
  return { values: {}, errors };
};

type FormError =
  | { kind: 'generic' }
  | { kind: 'network' }
  | { kind: 'rate_limited'; retryAfterSeconds: number };

export function SignUpForm() {
  const t = useTranslations('auth.signup');
  const rawLocale = useLocale();
  const locale = isLocale(rawLocale) ? rawLocale : 'fr';
  const router = useRouter();
  const acquisition = useAcquisitionTracking();
  const mutation = useRegisterCustomer();
  const { mutate: registerCustomer, isPending } = mutation;
  const [formError, setFormError] = useState<FormError | null>(null);
  const bannerRef = useRef<HTMLDivElement | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodV4Resolver,
    mode: 'onSubmit',
    defaultValues: {
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      acceptTerms: undefined,
      acceptMarketing: false,
    },
  });

  // RGAA AA: move keyboard focus to the form-level banner whenever it appears,
  // so SR + keyboard users land on the failure message instead of the disabled
  // submit button.
  useEffect(() => {
    if (formError) bannerRef.current?.focus();
  }, [formError]);

  const onSubmit = handleSubmit((data) => {
    setFormError(null);
    registerCustomer(
      {
        ...data,
        locale,
        ...(acquisition ? { acquisition } : {}),
      },
      {
        onSuccess: () => {
          // Clear plaintext password + PII from TanStack mutation cache
          // (visible via devtools / Sentry breadcrumbs otherwise).
          mutation.reset();
          router.push(`/${locale}/auth/verify-email-required`);
        },
        onError: (error) => {
          mutation.reset();
          const failure = classifySignUpError(error);
          if (failure.kind === 'rate_limited') {
            setFormError({ kind: 'rate_limited', retryAfterSeconds: failure.retryAfterSeconds });
          } else if (failure.kind === 'validation') {
            for (const issue of failure.issues) {
              const path = issue.path as FieldKey;
              if (
                path === 'email' ||
                path === 'password' ||
                path === 'firstName' ||
                path === 'lastName' ||
                path === 'acceptTerms'
              ) {
                setError(path, {
                  type: 'server',
                  message: zodIssueToI18nKey(path, 'server', issue.message),
                });
              }
            }
            setFormError({ kind: 'generic' });
          } else if (failure.kind === 'network') {
            setFormError({ kind: 'network' });
          } else {
            setFormError({ kind: 'generic' });
          }
        },
      },
    );
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError && (
        <div
          ref={bannerRef}
          role="alert"
          tabIndex={-1}
          className="p-3 bg-error-50 border border-error-300 rounded-md text-sm text-error-700 focus:outline-none focus:ring-2 focus:ring-error-400"
        >
          {formError.kind === 'rate_limited'
            ? t('errors.rateLimited', { seconds: formError.retryAfterSeconds })
            : formError.kind === 'network'
              ? t('errors.serviceUnavailable')
              : t('errors.generic')}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <FormField
          label={t('fields.firstName.label')}
          error={errors.firstName?.message ? t(`errors.${errors.firstName.message}`) : undefined}
          required
        >
          <Input
            type="text"
            placeholder={t('fields.firstName.placeholder')}
            autoComplete="given-name"
            {...register('firstName')}
          />
        </FormField>
        <FormField
          label={t('fields.lastName.label')}
          error={errors.lastName?.message ? t(`errors.${errors.lastName.message}`) : undefined}
          required
        >
          <Input
            type="text"
            placeholder={t('fields.lastName.placeholder')}
            autoComplete="family-name"
            {...register('lastName')}
          />
        </FormField>
      </div>

      <FormField
        label={t('fields.email.label')}
        error={errors.email?.message ? t(`errors.${errors.email.message}`) : undefined}
        required
      >
        <Input
          type="email"
          placeholder={t('fields.email.placeholder')}
          autoComplete="email"
          inputMode="email"
          {...register('email')}
        />
      </FormField>

      <FormField
        label={t('fields.password.label')}
        helper={!errors.password ? t('fields.password.helper') : undefined}
        error={errors.password?.message ? t(`errors.${errors.password.message}`) : undefined}
        required
      >
        <Input
          type="password"
          placeholder={t('fields.password.placeholder')}
          autoComplete="new-password"
          {...register('password')}
        />
      </FormField>

      <div className="flex items-start gap-2">
        <Controller
          control={control}
          name="acceptTerms"
          render={({ field }) => (
            <RadixCheckbox.Root
              id="acceptTerms"
              checked={field.value === true}
              onCheckedChange={(checked) => field.onChange(checked === true ? true : undefined)}
              className="mt-0.5 w-4 h-4 shrink-0 rounded-sm border border-cream-400 bg-cream-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 data-[state=checked]:bg-brand-500 data-[state=checked]:border-brand-500"
              aria-required="true"
              aria-invalid={errors.acceptTerms ? 'true' : undefined}
              aria-describedby={errors.acceptTerms ? 'acceptTerms-error' : undefined}
            >
              <RadixCheckbox.Indicator className="flex items-center justify-center text-cream-50">
                <CheckIcon size={12} />
              </RadixCheckbox.Indicator>
            </RadixCheckbox.Root>
          )}
        />
        <div>
          <label htmlFor="acceptTerms" className="text-sm text-charcoal-700 cursor-pointer">
            {t('fields.acceptTerms.label')}
          </label>
          {errors.acceptTerms && (
            <p id="acceptTerms-error" role="alert" className="text-xs text-error-500 mt-0.5">
              {t('errors.acceptTermsRequired')}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Controller
          control={control}
          name="acceptMarketing"
          render={({ field }) => (
            <RadixCheckbox.Root
              id="acceptMarketing"
              checked={field.value === true}
              onCheckedChange={(checked) => field.onChange(checked === true)}
              className="w-4 h-4 shrink-0 rounded-sm border border-cream-400 bg-cream-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 data-[state=checked]:bg-brand-500 data-[state=checked]:border-brand-500"
            >
              <RadixCheckbox.Indicator className="flex items-center justify-center text-cream-50">
                <CheckIcon size={12} />
              </RadixCheckbox.Indicator>
            </RadixCheckbox.Root>
          )}
        />
        <label htmlFor="acceptMarketing" className="text-sm text-charcoal-600 cursor-pointer">
          {t('fields.acceptMarketing.label')}
        </label>
      </div>

      <Button
        type="submit"
        variant="primary"
        className="w-full mt-2"
        loading={isPending}
        disabled={isPending}
        aria-busy={isPending}
      >
        {isPending ? t('loading') : t('cta')}
      </Button>

      <p className="text-sm text-center text-charcoal-600">
        {t('loginLink')}{' '}
        <Link href={`/${locale}/auth/login`} className="text-brand-600 hover:underline font-medium">
          {t('loginLinkLabel')}
        </Link>
      </p>
    </form>
  );
}
