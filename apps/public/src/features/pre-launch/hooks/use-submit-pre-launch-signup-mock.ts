'use client';

import { useRef, useState } from 'react';
import type { PreLaunchSignupInput } from '../schemas/pre-launch-signup.schema.js';

// Mock Story 0.17 — replaced by real hook from @tukio/api-client when Story 0.20 is done.
// TODO(Story 0.20): replace this file with `import { useSubmitPreLaunchSignup } from '@tukio/api-client/hooks/pre-launch'`
export function useSubmitPreLaunchSignup() {
  const [state, setState] = useState<{ isPending: boolean; error: Error | null }>({
    isPending: false,
    error: null,
  });
  // P6 fix: guard against concurrent submissions (e.g. double-Enter before isPending state commits).
  // Prevents duplicate router.push / duplicate waitlist entries when Story 0.20 replaces the mock.
  const submittingRef = useRef(false);

  const mutate = async (
    _input: PreLaunchSignupInput,
    callbacks: {
      onSuccess?: (result: { position: number }) => void;
      onError?: (error: Error) => void;
    } = {},
  ) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setState({ isPending: true, error: null });
    try {
      await new Promise((r) => setTimeout(r, 800));
      const position = Math.floor(Math.random() * 200) + 100;
      setState({ isPending: false, error: null });
      callbacks.onSuccess?.({ position });
    } finally {
      submittingRef.current = false;
    }
  };

  return { mutate, isPending: state.isPending, error: state.error };
}
