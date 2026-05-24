'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm, Controller, type Resolver } from 'react-hook-form';
import * as RadixCheckbox from '@radix-ui/react-checkbox';
import { CheckIcon, ArrowRight, Shield } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Kicker } from '@tukio/ui/components/Kicker';
import { Button } from '@tukio/ui/components/Button';
import {
  PreLaunchSignupSchema,
  type PreLaunchSignupInput,
} from '../schemas/pre-launch-signup.schema.js';
import { classifyPreLaunchError } from '../services/classify-pre-launch-error.js';
import { useSubmitPreLaunchSignup } from '@tukio/api-client/hooks/pre-launch';

type FormValues = Omit<PreLaunchSignupInput, 'locale'>;

// Path is coerced to string at the caller boundary (zodV4Resolver). Zod v4's
// inferred keyof can include symbol keys, so we accept plain string here.
function zodIssueToI18nKey(path: string, code: string): string {
  const map: Record<string, string> = {
    'firstName.required': 'fields.firstName.errors.required',
    'firstName.tooLong': 'fields.firstName.errors.tooLong',
    'lastName.required': 'fields.lastName.errors.required',
    'lastName.tooLong': 'fields.lastName.errors.tooLong',
    'email.invalid': 'fields.email.errors.invalid',
    'email.tooLong': 'fields.email.errors.tooLong',
    // P2 fix: was 'fields.role.label' (the legend text); unreachable via UI but mapped to a real error key.
    'role.invalid': 'errors.generic',
    'rgpdOptIn.required': 'fields.rgpd.errors.required',
  };
  const zodMsg =
    path + (code === 'too_small' ? '.required' : code === 'too_big' ? '.tooLong' : '.invalid');
  return map[zodMsg] ?? map[`${path}.${code}`] ?? 'errors.generic';
}

const FormSchema = PreLaunchSignupSchema.omit({ locale: true });

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
      message: zodIssueToI18nKey(path, issue.code),
    };
  }
  return { values: {}, errors };
};

type FormError =
  | { kind: 'generic' }
  | { kind: 'network' }
  | { kind: 'rate_limited'; retryAfterSeconds: number };

// Plausible custom event helper — no-op when the script isn't loaded
// (NEXT_PUBLIC_PLAUSIBLE_ENABLED=false in dev, or ad-blocker stripped it).
type PlausibleFn = (name: string, opts?: { props?: Record<string, string> }) => void;
function trackEvent(name: string, props?: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  const w = window as Window & { plausible?: PlausibleFn };
  w.plausible?.(name, props ? { props } : undefined);
}

interface ComingSoonFormClientProps {
  locale: string;
  initialRole: 'organisateur' | 'professionnel';
}

export function ComingSoonFormClient({ locale, initialRole }: ComingSoonFormClientProps) {
  const t = useTranslations('coming_soon.form');
  const router = useRouter();
  const [formError, setFormError] = useState<FormError | null>(null);
  const bannerRef = useRef<HTMLDivElement | null>(null);
  const { mutate, isPending } = useSubmitPreLaunchSignup();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodV4Resolver,
    mode: 'onSubmit',
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      role: initialRole,
      rgpdOptIn: undefined,
    },
  });

  useEffect(() => {
    if (formError) bannerRef.current?.focus();
  }, [formError]);

  const onSubmit = handleSubmit((data) => {
    setFormError(null);
    trackEvent('Coming Soon Form Submit', { role: data.role, locale });
    // P10 fix: derive locale from prop (single source of truth) — was rawLocale via useLocale().
    mutate(
      { ...data, locale: locale === 'en' ? 'en' : 'fr' },
      {
        onSuccess: ({ position, alreadySubscribed }) => {
          trackEvent('Coming Soon Form Submit Success', {
            role: data.role,
            locale,
            alreadySubscribed: String(alreadySubscribed ?? false),
          });
          // P12 fix: encode position defensively (Story 0.20 may return string-typed values).
          router.push(
            `/${locale}/coming-soon/success?firstName=${encodeURIComponent(data.firstName)}&position=${encodeURIComponent(String(position))}`,
          );
        },
        onError: (error) => {
          const failure = classifyPreLaunchError(error);
          if (failure.kind === 'rate_limited') {
            setFormError({ kind: 'rate_limited', retryAfterSeconds: failure.retryAfterSeconds });
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
    <>
      <Kicker color="brand">{t('kicker')}</Kicker>

      <h2
        id="coming-soon-form-heading"
        className="font-display text-[32px] font-medium tracking-tight text-charcoal-800 mt-2.5 leading-[1.1]"
      >
        {t('titleLine1')} <em className="italic text-brand-600">{t('titleEmphasis')}</em>.
      </h2>

      <p className="text-[14px] text-charcoal-600 mt-2.5 leading-[1.55]">{t('subtitle')}</p>

      <form
        onSubmit={onSubmit}
        noValidate
        className="mt-7 flex flex-col gap-4"
        aria-labelledby="coming-soon-form-heading"
      >
        {formError && (
          <div
            ref={bannerRef}
            role="alert"
            tabIndex={-1}
            className="rounded-md border border-error-500/30 bg-error-50 p-3 text-sm leading-snug text-error-700 focus:outline-none"
          >
            {formError.kind === 'rate_limited'
              ? t('errors.rateLimited', { seconds: formError.retryAfterSeconds })
              : formError.kind === 'network'
                ? t('errors.network')
                : t('errors.generic')}
          </div>
        )}

        {/* Row 1: firstName + lastName */}
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <Field
            id="firstName"
            label={t('fields.firstName.label')}
            error={errors.firstName ? t(errors.firstName.message as string) : undefined}
          >
            <input
              id="firstName"
              type="text"
              autoComplete="given-name"
              placeholder={t('fields.firstName.placeholder')}
              aria-describedby={errors.firstName ? 'firstName-error' : undefined}
              className="rounded-md border border-cream-300 bg-cream-50 px-3.5 py-2.5 text-sm text-charcoal-800 placeholder:text-charcoal-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              {...register('firstName')}
            />
          </Field>

          <Field
            id="lastName"
            label={t('fields.lastName.label')}
            error={errors.lastName ? t(errors.lastName.message as string) : undefined}
          >
            <input
              id="lastName"
              type="text"
              autoComplete="family-name"
              placeholder={t('fields.lastName.placeholder')}
              aria-describedby={errors.lastName ? 'lastName-error' : undefined}
              className="rounded-md border border-cream-300 bg-cream-50 px-3.5 py-2.5 text-sm text-charcoal-800 placeholder:text-charcoal-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              {...register('lastName')}
            />
          </Field>
        </div>

        {/* Row 2: email */}
        <Field
          id="email"
          label={t('fields.email.label')}
          error={errors.email ? t(errors.email.message as string) : undefined}
        >
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={t('fields.email.placeholder')}
            aria-describedby={errors.email ? 'email-error' : undefined}
            className="rounded-md border border-cream-300 bg-cream-50 px-3.5 py-2.5 text-sm text-charcoal-800 placeholder:text-charcoal-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            {...register('email')}
          />
        </Field>

        {/* Row 3: role radio cards */}
        <Controller
          name="role"
          control={control}
          render={({ field }) => (
            <fieldset>
              <legend className="text-[13px] font-semibold text-charcoal-600 mb-2">
                {t('fields.role.label')}
              </legend>
              <div className="grid grid-cols-2 gap-2.5 max-sm:grid-cols-1">
                {(['organisateur', 'professionnel'] as const).map((r) => {
                  const isActive = field.value === r;
                  const labelKey = r === 'organisateur' ? 'organizer' : 'professional';
                  return (
                    <label
                      key={r}
                      className={`flex cursor-pointer items-start gap-3 rounded-md border p-3.5 transition-colors ${
                        isActive
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-cream-300 bg-cream-50 text-charcoal-800 hover:bg-cream-100'
                      }`}
                    >
                      {/* P9 fix: removed redundant aria-checked — native <input type=radio> exposes checked state via the a11y tree. */}
                      <input
                        type="radio"
                        name="role"
                        value={r}
                        checked={isActive}
                        onChange={() => field.onChange(r)}
                        className="mt-0.5 accent-brand-500"
                      />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[13px] font-semibold leading-tight">
                          {t(`fields.role.${labelKey}.title`)}
                        </span>
                        <span
                          className={`text-[12px] leading-tight ${isActive ? 'text-brand-600' : 'text-charcoal-500'}`}
                        >
                          {t(`fields.role.${labelKey}.sub`)}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
        />

        {/* Row 4: RGPD checkbox */}
        <Controller
          name="rgpdOptIn"
          control={control}
          render={({ field }) => (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-start gap-2.5">
                {/* P11 dismissed: Radix Checkbox renders <button role="checkbox">, not <input>.
                    Browsers don't autofill button elements, so autoComplete is not applicable. */}
                <RadixCheckbox.Root
                  id="rgpdOptIn"
                  checked={field.value === true}
                  onCheckedChange={(val) => field.onChange(val === true ? true : undefined)}
                  aria-describedby={errors.rgpdOptIn ? 'rgpd-error' : undefined}
                  className="mt-0.5 h-4 w-4 min-w-[16px] rounded border border-cream-400 bg-cream-50 data-[state=checked]:border-brand-500 data-[state=checked]:bg-brand-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
                >
                  <RadixCheckbox.Indicator>
                    <CheckIcon size={12} className="text-white" strokeWidth={3} />
                  </RadixCheckbox.Indicator>
                </RadixCheckbox.Root>
                <label htmlFor="rgpdOptIn" className="text-[12px] leading-snug text-charcoal-600">
                  {t('fields.rgpd.label')}
                  <Link
                    href={`/${locale}/privacy`}
                    className="text-brand-700 underline underline-offset-2 hover:text-brand-800"
                  >
                    {t('fields.rgpd.linkLabel')}
                  </Link>
                  .
                </label>
              </div>
              {errors.rgpdOptIn && (
                <p id="rgpd-error" role="alert" className="text-xs text-error-500">
                  {t('fields.rgpd.errors.required')}
                </p>
              )}
            </div>
          )}
        />

        {/* CTA — P8 fix: use @tukio/ui Button atom instead of raw Tailwind classes (Story 0.4 design system). */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={isPending}
          iconRight={!isPending ? <ArrowRight size={16} aria-hidden="true" /> : undefined}
          className="w-full mt-2"
        >
          {isPending ? t('submitting') : t('submit')}
        </Button>

        {/* Reassurance */}
        <p className="flex items-center justify-center gap-1.5 text-[12px] text-charcoal-500 text-center mt-1">
          <Shield size={13} color="var(--color-success-500)" aria-hidden="true" />
          {t('reassurance')}
        </p>
      </form>
    </>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-charcoal-600">
        {label}
      </label>
      {children}
      {/* P4 fix: role="alert" implies aria-live="assertive" — removed aria-live="polite" (conflict). */}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs leading-snug text-error-500">
          {error}
        </p>
      )}
    </div>
  );
}
