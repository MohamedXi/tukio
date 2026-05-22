import { Resend } from 'resend';

// Lazy memoized Resend SDK client.
// Construction is deferred so that `new Resend('')` doesn't run at module load
// when RESEND_API_KEY is intentionally absent (dev fallback path).

let resendInstance: Resend | undefined;

export function getResendClient(): Resend {
  if (!resendInstance) {
    const apiKey = process.env['RESEND_API_KEY'];
    if (!apiKey) {
      throw new Error('RESEND_API_KEY must be set to call the Resend SDK');
    }
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}

// Backwards-compat proxy used by handlers that previously imported `resendClient`.
// Each property access constructs on demand and forwards.
export const resendClient = {
  get contacts() {
    return getResendClient().contacts;
  },
  get emails() {
    return getResendClient().emails;
  },
};

// Test helper.
export function __resetResendClientForTests(): void {
  resendInstance = undefined;
}
