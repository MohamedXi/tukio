'use client';

import { useState } from 'react';
import type { ContactFormInput } from '../schemas/contact-form.schema.js';

// Transitoire Story 0.19 — remplacer par `@tukio/api-client/hooks/pre-launch` dès Story 0.20.
// Signature compatible avec le real hook (mutate + isPending).
export function useSubmitContactForm() {
  const [isPending, setIsPending] = useState(false);

  function mutate(
    _data: ContactFormInput,
    callbacks: { onSuccess: () => void; onError: (err: Error) => void },
  ) {
    setIsPending(true);
    setTimeout(() => {
      setIsPending(false);
      callbacks.onSuccess();
    }, 800);
  }

  return { mutate, isPending };
}
