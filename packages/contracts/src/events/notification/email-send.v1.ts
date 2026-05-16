import type { DomainEvent } from '../../types/DomainEvent.js';
import type { Locale } from '../../types/Locale.js';

export const EMAIL_TEMPLATE_IDS = [
  'email-verify',
  'password-reset',
  'booking-confirmed',
  'booking-accepted',
  'booking-refused',
  'booking-cancelled',
  'review-request',
  'pro-verified',
  'pro-rejected',
] as const;

export type EmailTemplateId = (typeof EMAIL_TEMPLATE_IDS)[number];

export interface EmailSendV1Payload {
  templateId: EmailTemplateId;
  locale: Locale;
  to: {
    email: string;
    userId?: string | null;
    name?: string;
  };
  params: Record<string, unknown>;
}

export type EmailSendV1 = DomainEvent<EmailSendV1Payload> & {
  eventType: 'notification.email.send.v1';
  eventVersion: 'v1';
};

export const EMAIL_SEND_V1_TYPE = 'notification.email.send.v1' as const;
