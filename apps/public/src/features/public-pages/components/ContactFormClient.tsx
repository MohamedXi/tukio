'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@tukio/ui/components/Button';
import { ContactFormSchema, type ContactFormValues } from '../schemas/contact-form.schema.js';
import { classifyContactError } from '../services/classify-contact-error.js';
import { useSubmitContactForm } from '../hooks/use-submit-contact-form-mock.js';

type ContactError =
  | { kind: 'generic' }
  | { kind: 'network' }
  | { kind: 'rate_limited'; retryAfterSeconds: number };

const FormSchema = ContactFormSchema.omit({ locale: true });

const zodResolver: Resolver<ContactFormValues> = async (values) => {
  const result = FormSchema.safeParse(values);
  if (result.success) return { values: result.data, errors: {} };
  const errors: Record<string, { type: string; message: string }> = {};
  for (const issue of result.error.issues) {
    const head = issue.path[0];
    const path = typeof head === 'string' ? head : String(head ?? '');
    if (!path || errors[path]) continue;
    errors[path] = { type: issue.code, message: issue.message };
  }
  return { values: {}, errors };
};

interface ContactFormClientProps {
  locale: string;
}

const INPUT_CLASS =
  'w-full rounded-md border border-cream-300 bg-cream-50 px-3.5 py-2.5 text-sm text-charcoal-800 placeholder:text-charcoal-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

export function ContactFormClient({ locale }: ContactFormClientProps) {
  const t = useTranslations('contact.form');
  const [formError, setFormError] = useState<ContactError | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const bannerRef = useRef<HTMLDivElement | null>(null);
  const { mutate, isPending } = useSubmitContactForm();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactFormValues>({
    resolver: zodResolver,
    mode: 'onSubmit',
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      category: undefined,
      subject: undefined,
      message: '',
    },
  });

  useEffect(() => {
    if (formError) bannerRef.current?.focus();
  }, [formError]);

  const onSubmit = handleSubmit((data) => {
    setFormError(null);
    setSubmitted(false);
    mutate(
      { ...data, locale: locale === 'en' ? 'en' : 'fr' },
      {
        onSuccess: () => {
          setSubmitted(true);
          reset();
        },
        onError: (error) => {
          const failure = classifyContactError(error);
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
    <div className="p-8 rounded-xl bg-cream-50 border border-cream-200">
      <h2 className="text-[22px] font-display font-medium text-charcoal-800 mb-5">{t('title')}</h2>

      {submitted && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-5 rounded-md border border-success-500/30 bg-success-50 p-3 text-sm text-success-700"
        >
          {t('successMessage')}
        </div>
      )}

      {formError && (
        <div
          ref={bannerRef}
          role="alert"
          tabIndex={-1}
          className="mb-5 rounded-md border border-error-500/30 bg-error-50 p-3 text-sm text-error-700 focus:outline-none"
        >
          {formError.kind === 'rate_limited'
            ? t('errors.rateLimited', { seconds: formError.retryAfterSeconds })
            : formError.kind === 'network'
              ? t('errors.network')
              : t('errors.generic')}
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3.5">
        {/* Row 1: firstName + lastName */}
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <Field
            id="firstName"
            label={t('fields.firstName.label')}
            error={
              errors.firstName?.message
                ? t(errors.firstName.message as Parameters<typeof t>[0])
                : undefined
            }
          >
            <input
              id="firstName"
              type="text"
              autoComplete="given-name"
              placeholder={t('fields.firstName.placeholder')}
              aria-describedby={errors.firstName ? 'firstName-error' : undefined}
              aria-invalid={errors.firstName ? 'true' : undefined}
              className={INPUT_CLASS}
              {...register('firstName')}
            />
          </Field>
          <Field
            id="lastName"
            label={t('fields.lastName.label')}
            error={
              errors.lastName?.message
                ? t(errors.lastName.message as Parameters<typeof t>[0])
                : undefined
            }
          >
            <input
              id="lastName"
              type="text"
              autoComplete="family-name"
              placeholder={t('fields.lastName.placeholder')}
              aria-describedby={errors.lastName ? 'lastName-error' : undefined}
              aria-invalid={errors.lastName ? 'true' : undefined}
              className={INPUT_CLASS}
              {...register('lastName')}
            />
          </Field>
        </div>

        {/* Email */}
        <Field
          id="email"
          label={t('fields.email.label')}
          error={
            errors.email?.message ? t(errors.email.message as Parameters<typeof t>[0]) : undefined
          }
        >
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={t('fields.email.placeholder')}
            aria-describedby={errors.email ? 'email-error' : undefined}
            aria-invalid={errors.email ? 'true' : undefined}
            className={INPUT_CLASS}
            {...register('email')}
          />
        </Field>

        {/* Category */}
        <Field
          id="category"
          label={t('fields.category.label')}
          error={
            errors.category?.message
              ? t(errors.category.message as Parameters<typeof t>[0])
              : undefined
          }
        >
          <div className="relative">
            <select
              id="category"
              aria-describedby={errors.category ? 'category-error' : undefined}
              aria-invalid={errors.category ? 'true' : undefined}
              className={`${INPUT_CLASS} appearance-none pr-9`}
              {...register('category')}
            >
              <option value="">{t('fields.category.placeholder')}</option>
              {(
                ['organisateur', 'professionnel', 'journaliste', 'partenaire', 'autre'] as const
              ).map((v) => (
                <option key={v} value={v}>
                  {t(`fields.category.options.${v}`)}
                </option>
              ))}
            </select>
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-400"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </Field>

        {/* Subject */}
        <Field
          id="subject"
          label={t('fields.subject.label')}
          error={
            errors.subject?.message
              ? t(errors.subject.message as Parameters<typeof t>[0])
              : undefined
          }
        >
          <div className="relative">
            <select
              id="subject"
              aria-describedby={errors.subject ? 'subject-error' : undefined}
              aria-invalid={errors.subject ? 'true' : undefined}
              className={`${INPUT_CLASS} appearance-none pr-9`}
              {...register('subject')}
            >
              <option value="">{t('fields.subject.placeholder')}</option>
              {(['general', 'devenirPro', 'technique', 'partenariat', 'presse'] as const).map(
                (v) => (
                  <option key={v} value={v}>
                    {t(`fields.subject.options.${v}`)}
                  </option>
                ),
              )}
            </select>
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-400"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </Field>

        {/* Message */}
        <Field
          id="message"
          label={t('fields.message.label')}
          error={
            errors.message?.message
              ? t(errors.message.message as Parameters<typeof t>[0])
              : undefined
          }
        >
          <textarea
            id="message"
            rows={6}
            placeholder={t('fields.message.placeholder')}
            aria-describedby={errors.message ? 'message-error' : undefined}
            aria-invalid={errors.message ? 'true' : undefined}
            className={`${INPUT_CLASS} resize-vertical`}
            style={{ height: 'auto' }}
            {...register('message')}
          />
        </Field>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={isPending}
          iconRight={!isPending ? <ArrowRight size={16} aria-hidden="true" /> : undefined}
          className="w-full mt-1"
        >
          {isPending ? t('submitting') : t('submit')}
        </Button>

        <p className="text-[12px] text-charcoal-500 text-center leading-[1.5]">{t('disclaimer')}</p>
      </form>
    </div>
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
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs leading-snug text-error-500">
          {error}
        </p>
      )}
    </div>
  );
}
