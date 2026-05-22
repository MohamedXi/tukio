import { Resend } from 'resend';

// Singleton instantiated once at module level (cold start) — avoids creating
// a new Resend client on every request in the route handlers.
export const resendClient = new Resend(process.env['RESEND_API_KEY'] ?? '');
