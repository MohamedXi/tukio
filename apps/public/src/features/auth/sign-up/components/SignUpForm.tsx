'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
import { classifySignUpError } from '../services/sign-up.service.js';

const FormSchema = RegisterCustomerInputSchema.omit({ locale: true });
type FormValues = Omit<RegisterCustomerInputDto, 'locale'>;

type FieldKey = keyof FormValues;

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

interface PasswordStrength {
  level: 'empty' | 'weak' | 'medium' | 'strong';
  score: number;
}

function computePasswordStrength(password: string): PasswordStrength {
  if (!password) return { level: 'empty', score: 0 };
  let score = 0;
  if (password.length >= 12) score += 1;
  if (/\p{Ll}/u.test(password)) score += 1;
  if (/\p{Lu}/u.test(password)) score += 1;
  if (/\d/u.test(password)) score += 1;
  if (/[^\p{L}\p{N}]/u.test(password)) score += 1;
  const level = score >= 5 ? 'strong' : score >= 3 ? 'medium' : 'weak';
  return { level, score };
}

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
    watch,
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

  const password = watch('password');
  const strength = useMemo(() => computePasswordStrength(password ?? ''), [password]);

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
          mutation.reset();
          const params = new URLSearchParams({ email: data.email });
          router.push(`/${locale}/auth/verify-email-required?${params.toString()}`);
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

  /* Form rhythm (compact — see packages/ui/src/styles/theme.css "Semantic spacing").
     Tightened to match the Cloud Design auth maquette so the page fits a
     single viewport (~800-900px) without scroll on standard laptops.
     - Form root: gap-4 (16px between sections)
     - Sibling fields: gap-3 (12px)
     - Checkbox stack: gap-2.5 (10px)
     - Secondary links: gap-1 with gap-3 from CTA */
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError && (
        <div
          ref={bannerRef}
          role="alert"
          tabIndex={-1}
          className="rounded-md border border-error-500/30 bg-error-50 p-3 text-sm leading-snug text-error-700 focus:outline-none focus:ring-2 focus:ring-error-500/40"
        >
          {formError.kind === 'rate_limited'
            ? t('errors.rateLimited', { seconds: formError.retryAfterSeconds })
            : formError.kind === 'network'
              ? t('errors.serviceUnavailable')
              : t('errors.generic')}
        </div>
      )}

      {/* Section 1 — Social providers (placeholders, OAuth = Story 1.4) */}
      <div className="flex flex-col gap-2">
        <SocialButton provider="google" disabled label={t('social.google')} />
        <SocialButton provider="apple" disabled label={t('social.apple')} />
      </div>

      <Separator label={t('separator')} />

      {/* Section 2 — Email/password fields */}
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field
            id="firstName"
            label={t('fields.firstName.label')}
            error={errors.firstName?.message ? t(`errors.${errors.firstName.message}`) : undefined}
          >
            <input
              id="firstName"
              type="text"
              placeholder={t('fields.firstName.placeholder')}
              autoComplete="given-name"
              className={inputClass(!!errors.firstName)}
              {...register('firstName')}
            />
          </Field>
          <Field
            id="lastName"
            label={t('fields.lastName.label')}
            error={errors.lastName?.message ? t(`errors.${errors.lastName.message}`) : undefined}
          >
            <input
              id="lastName"
              type="text"
              placeholder={t('fields.lastName.placeholder')}
              autoComplete="family-name"
              className={inputClass(!!errors.lastName)}
              {...register('lastName')}
            />
          </Field>
        </div>

        <Field
          id="email"
          label={t('fields.email.label')}
          error={errors.email?.message ? t(`errors.${errors.email.message}`) : undefined}
        >
          <input
            id="email"
            type="email"
            placeholder={t('fields.email.placeholder')}
            autoComplete="email"
            inputMode="email"
            className={inputClass(!!errors.email)}
            {...register('email')}
          />
        </Field>

        <Field
          id="password"
          label={t('fields.password.label')}
          error={errors.password?.message ? t(`errors.${errors.password.message}`) : undefined}
          helper={!errors.password && !password ? t('fields.password.helper') : undefined}
        >
          <input
            id="password"
            type="password"
            placeholder={t('fields.password.placeholder')}
            autoComplete="new-password"
            className={inputClass(!!errors.password)}
            {...register('password')}
          />
          {password && !errors.password && <PasswordStrengthMeter strength={strength} />}
        </Field>
      </div>

      {/* Section 3 — Consent checkboxes */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col gap-1.5">
          <label className="flex items-start gap-2.5 text-[13px] leading-snug text-charcoal-600">
            <Controller
              control={control}
              name="acceptTerms"
              render={({ field }) => (
                <RadixCheckbox.Root
                  id="acceptTerms"
                  checked={field.value === true}
                  onCheckedChange={(checked) => field.onChange(checked === true ? true : undefined)}
                  className="mt-0.5 size-4 shrink-0 rounded-sm border border-cream-300 bg-cream-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20 data-[state=checked]:border-brand-500 data-[state=checked]:bg-brand-500"
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
            <span>
              {t.rich('fields.acceptTerms.label', {
                terms: (chunks) => (
                  <Link
                    href={`/${locale}/legal/terms`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {chunks}
                  </Link>
                ),
                privacy: (chunks) => (
                  <Link
                    href={`/${locale}/legal/privacy`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </span>
          </label>
          {errors.acceptTerms && (
            <p id="acceptTerms-error" role="alert" className="ml-7 text-xs text-error-500">
              {t('errors.acceptTermsRequired')}
            </p>
          )}
        </div>

        <label className="flex items-start gap-2.5 text-[13px] leading-snug text-charcoal-600">
          <Controller
            control={control}
            name="acceptMarketing"
            render={({ field }) => (
              <RadixCheckbox.Root
                id="acceptMarketing"
                checked={field.value === true}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                className="mt-0.5 size-4 shrink-0 rounded-sm border border-cream-300 bg-cream-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20 data-[state=checked]:border-brand-500 data-[state=checked]:bg-brand-500"
              >
                <RadixCheckbox.Indicator className="flex items-center justify-center text-cream-50">
                  <CheckIcon size={12} />
                </RadixCheckbox.Indicator>
              </RadixCheckbox.Root>
            )}
          />
          <span>{t('fields.acceptMarketing.label')}</span>
        </label>
      </div>

      {/* Section 4 — Primary CTA + secondary links */}
      <div className="flex flex-col gap-3">
        <button
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
          className="mt-1 inline-flex h-11 w-full items-center justify-center rounded-md bg-brand-500 px-5 text-base font-medium text-cream-50 transition-colors hover:bg-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? t('loading') : t('cta')}
        </button>

        <div className="flex flex-col gap-1 text-center">
          <p className="text-[13px] text-charcoal-500">
            {t('loginLink')}{' '}
            <Link
              href={`/${locale}/auth/login`}
              className="font-medium text-brand-700 hover:underline"
            >
              {t('loginLinkLabel')}
            </Link>
          </p>
          <p className="text-xs text-charcoal-400">
            {t('proLink')}{' '}
            <Link
              href={`/${locale}/seller/onboarding`}
              className="font-medium text-charcoal-600 hover:underline"
            >
              {t('proLinkLabel')}
            </Link>
          </p>
        </div>
      </div>
    </form>
  );
}

/* ─── Local atoms ──────────────────────────────────────────────── */

function inputClass(hasError: boolean): string {
  return [
    'h-10 w-full rounded-md border bg-cream-50 px-3 text-sm text-charcoal-700 outline-none transition placeholder:text-charcoal-400',
    'focus:border-brand-500 focus:ring-[3px] focus:ring-brand-500/20',
    hasError ? 'border-error-500' : 'border-cream-300',
  ].join(' ');
}

function Field({
  id,
  label,
  error,
  helper,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-charcoal-600">
        {label}
      </label>
      {children}
      {error && (
        <p role="alert" className="text-xs leading-snug text-error-500">
          {error}
        </p>
      )}
      {!error && helper && <p className="text-xs leading-snug text-charcoal-400">{helper}</p>}
    </div>
  );
}

function Separator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.06em] text-charcoal-400">
      <span className="h-px flex-1 bg-cream-300" />
      <span>{label}</span>
      <span className="h-px flex-1 bg-cream-300" />
    </div>
  );
}

function SocialButton({
  provider,
  label,
  disabled,
}: {
  provider: 'google' | 'apple';
  label: string;
  disabled?: boolean;
}) {
  const glyph =
    provider === 'google' ? (
      <span className="font-display font-bold">G</span>
    ) : (
      <span className="text-base leading-none"></span>
    );
  return (
    <button
      type="button"
      disabled={disabled}
      title={disabled ? 'Story 1.4' : undefined}
      className="inline-flex h-10 w-full items-center justify-center gap-2.5 rounded-md border border-cream-300 bg-cream-100 px-4 text-sm font-medium text-charcoal-700 transition-colors hover:bg-cream-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="inline-flex size-5 items-center justify-center rounded-[4px] border border-cream-300 bg-cream-50 text-xs text-charcoal-700">
        {glyph}
      </span>
      {label}
    </button>
  );
}

function PasswordStrengthMeter({ strength }: { strength: PasswordStrength }) {
  if (strength.level === 'empty') return null;
  const colorByLevel = {
    weak: 'text-error-500',
    medium: 'text-warning-500',
    strong: 'text-success-700',
  } as const;
  const dotColor =
    strength.level === 'strong'
      ? 'bg-success-500'
      : strength.level === 'medium'
        ? 'bg-warning-500'
        : 'bg-error-500';
  // Early-return above narrows the type to 'weak' | 'medium' | 'strong'.
  const labelByLevel: Record<'weak' | 'medium' | 'strong', string> = {
    weak: 'Faible',
    medium: 'Moyen',
    strong: 'Fort',
  };
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className={`inline-block size-1.5 rounded-full ${dotColor}`} aria-hidden />
      <span className={`font-medium ${colorByLevel[strength.level]}`}>
        {labelByLevel[strength.level]}
      </span>
    </div>
  );
}
