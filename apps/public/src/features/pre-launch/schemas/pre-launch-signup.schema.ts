import { z } from 'zod';

export const PreLaunchSignupSchema = z.object({
  firstName: z.string().trim().min(1, 'firstName.required').max(80, 'firstName.tooLong'),
  lastName: z.string().trim().min(1, 'lastName.required').max(80, 'lastName.tooLong'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('email.invalid')
    .max(254, 'email.tooLong')
    .refine((v) => !/[\r\n]/.test(v), { message: 'email.invalid' }),
  role: z.enum(['organisateur', 'professionnel'], {
    error: () => ({ message: 'role.invalid' }),
  }),
  rgpdOptIn: z.literal(true, {
    error: () => ({ message: 'rgpdOptIn.required' }),
  }),
  locale: z.enum(['fr', 'en']),
});

export type PreLaunchSignupInput = z.infer<typeof PreLaunchSignupSchema>;
