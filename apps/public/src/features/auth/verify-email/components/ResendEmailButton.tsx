'use client';

import { useEffect, useState } from 'react';
import { RepeatIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ResendEmailButtonProps {
  /** Seconds the user must wait before the resend button becomes active. */
  initialCountdownSeconds: number;
}

/**
 * Renvoi de l'email de vérification — Story 1.2d placeholder.
 *
 * Visual fidelity with the Cloud Design maquette: a secondary outlined button
 * with the rotation icon, the localized label, and an inline countdown badge
 * showing how many seconds remain before the action is available again.
 *
 * The actual resend (POST `/v1/auth/email/resend`) lands in Story 1.6 — until
 * then the button stays in countdown mode and shows a "deferred" tooltip when
 * clicked after the timer hits zero.
 */
export function ResendEmailButton({ initialCountdownSeconds }: ResendEmailButtonProps) {
  const t = useTranslations('auth.verifyEmailRequired.resend');
  const [secondsLeft, setSecondsLeft] = useState(initialCountdownSeconds);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsLeft]);

  const ready = secondsLeft <= 0;

  return (
    <button
      type="button"
      // Story 1.6: even when the countdown hits 0 the actual POST is not wired
      // yet, so keep the button disabled and surface a tooltip explaining why.
      disabled
      title={ready ? t('deferredNote') : undefined}
      aria-busy={false}
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-cream-300 bg-cream-50 px-5 text-sm font-medium text-charcoal-700 transition-colors hover:bg-cream-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 disabled:cursor-not-allowed disabled:opacity-70"
    >
      <RepeatIcon size={16} aria-hidden="true" />
      <span>{ready ? t('available') : t('label')}</span>
      {!ready && (
        <span className="text-xs text-charcoal-400">
          {t('countdown', { seconds: secondsLeft })}
        </span>
      )}
    </button>
  );
}
