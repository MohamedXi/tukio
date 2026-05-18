'use client';

import { useState } from 'react';
import { Button } from '@tukio/ui/button';

interface LoginCtaProps {
  locale: string;
  ctaLabel: string;
  loadingLabel: string;
}

export function LoginCta({ locale, ctaLabel, loadingLabel }: LoginCtaProps) {
  const [pending, setPending] = useState(false);

  function handleSignIn() {
    setPending(true);
    const next = new URLSearchParams(window.location.search).get('next');
    const gatewayUrl = process.env['NEXT_PUBLIC_GATEWAY_URL'];
    const url = new URL(`${gatewayUrl ?? 'http://localhost:4000'}/v1/auth/login`);
    url.searchParams.set('clientId', 'tukio-web');
    url.searchParams.set('locale', locale);
    if (next) url.searchParams.set('next', next);
    window.location.assign(url.toString());
  }

  return (
    <Button
      variant="primary"
      size="lg"
      className="w-full"
      onClick={handleSignIn}
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? loadingLabel : ctaLabel}
    </Button>
  );
}
