import { z } from 'zod';
import type { UserProfile } from '../../../domain/model/user-profile.aggregate.js';

// Local Zod schema for UserProfile API response.
// TODO Story 1.x: lift this schema into @tukio/contracts/dtos/auth so it stays
// in sync with the gateway-api OpenAPI surface.
export const UserProfileResponseSchema = z
  .object({
    id: z.uuid(),
    keycloakUserId: z.uuid(),
    email: z.email(),
    firstName: z.string().min(1).max(80),
    lastName: z.string().min(1).max(80),
    role: z.enum([
      'client',
      'pro',
      'admin-support',
      'admin-modo',
      'admin-super',
    ]),
    locale: z.enum(['fr', 'en']),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    deletedAt: z.iso.datetime().nullable(),
  })
  .strict();

export type UserProfileResponseDto = z.infer<typeof UserProfileResponseSchema>;

export const toUserProfileResponseDto = (
  aggregate: UserProfile,
): UserProfileResponseDto => ({
  id: aggregate.id,
  keycloakUserId: aggregate.keycloakUserId,
  email: aggregate.email.toString(),
  firstName: aggregate.firstName,
  lastName: aggregate.lastName,
  role: aggregate.role,
  locale: aggregate.locale,
  createdAt: aggregate.createdAt.toISOString(),
  updatedAt: aggregate.updatedAt.toISOString(),
  deletedAt: aggregate.deletedAt ? aggregate.deletedAt.toISOString() : null,
});
