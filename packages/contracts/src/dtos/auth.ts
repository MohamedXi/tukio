import { z } from 'zod';

export const RegisterCustomerSchema = z.object({
  email: z.email(),
  password: z.string().min(12).max(128),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  locale: z.enum(['fr', 'en']),
  acceptedTermsAt: z.iso.datetime(),
});

export type RegisterCustomerDto = z.infer<typeof RegisterCustomerSchema>;
