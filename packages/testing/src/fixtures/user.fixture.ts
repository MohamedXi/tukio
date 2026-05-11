import { faker, fakerFR } from '@faker-js/faker';

// Default to French names — Tukio MVP is FR-only (Pays de la Loire). Override
// via overrides.firstName/lastName for English-named users in en-locale tests.
const f = fakerFR;

export type UserRole = 'client' | 'pro' | 'admin-support' | 'admin-modo' | 'admin-super';

export interface UserFixture {
  id: string;
  keycloakUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  locale: 'fr' | 'en';
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export function buildUser(overrides: Partial<UserFixture> = {}): UserFixture {
  const firstName = overrides.firstName ?? f.person.firstName();
  const lastName = overrides.lastName ?? f.person.lastName();
  return {
    id: faker.string.uuid(),
    keycloakUserId: faker.string.uuid(),
    email: faker.internet.email({ firstName, lastName }).toLowerCase(),
    firstName,
    lastName,
    role: 'client',
    locale: 'fr',
    createdAt: faker.date.past(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

export const buildClient = (overrides: Partial<UserFixture> = {}): UserFixture =>
  buildUser({ role: 'client', ...overrides });

export const buildPro = (overrides: Partial<UserFixture> = {}): UserFixture =>
  buildUser({ role: 'pro', ...overrides });

export const buildAdminSupport = (overrides: Partial<UserFixture> = {}): UserFixture =>
  buildUser({ role: 'admin-support', ...overrides });

export const buildAdminModo = (overrides: Partial<UserFixture> = {}): UserFixture =>
  buildUser({ role: 'admin-modo', ...overrides });

export const buildAdminSuper = (overrides: Partial<UserFixture> = {}): UserFixture =>
  buildUser({ role: 'admin-super', ...overrides });
