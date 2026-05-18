import { z } from 'zod';

export const UserRoleEnum = z.enum(['client', 'pro', 'admin-support', 'admin-modo', 'admin-super']);
export type UserRole = z.infer<typeof UserRoleEnum>;

export const UserStatusEnum = z.enum([
  'active',
  'pending_email_verification',
  'pending_admin_review',
  'rejected',
  'suspended',
  'deleted',
]);
export type UserStatus = z.infer<typeof UserStatusEnum>;

export const WhoamiResponseSchema = z
  .object({
    userId: z.uuid(),
    email: z.email(),
    role: z.array(UserRoleEnum).min(1),
    status: UserStatusEnum,
    locale: z.enum(['fr', 'en']),
    emailVerified: z.boolean(),
    mfaEnabled: z.boolean(),
  })
  .strict();

export type WhoamiResponseDto = z.infer<typeof WhoamiResponseSchema>;
