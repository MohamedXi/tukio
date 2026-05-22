import { z } from 'zod';

export const ContactFormSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, 'errors.firstName.required')
    .max(80, 'errors.firstName.tooLong'),
  lastName: z.string().trim().min(1, 'errors.lastName.required').max(80, 'errors.lastName.tooLong'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'errors.email.invalid')
    .email('errors.email.invalid')
    .max(254, 'errors.email.tooLong'),
  category: z.enum(['organisateur', 'professionnel', 'journaliste', 'partenaire', 'autre'], {
    error: () => ({ message: 'errors.category.invalid' }),
  }),
  subject: z.enum(['general', 'devenirPro', 'technique', 'partenariat', 'presse'], {
    error: () => ({ message: 'errors.subject.invalid' }),
  }),
  message: z.string().trim().min(10, 'errors.message.tooShort').max(2000, 'errors.message.tooLong'),
  locale: z.enum(['fr', 'en']),
});

export type ContactFormInput = z.infer<typeof ContactFormSchema>;
export type ContactFormValues = Omit<ContactFormInput, 'locale'>;
