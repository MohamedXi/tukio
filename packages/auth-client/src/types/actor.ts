// Frontend-facing Actor — subset of backend BackendActor (no email/amr server fields).
export type { Actor } from '@tukio/contracts/types/Actor.js';

export type Role = 'client' | 'pro' | 'admin-support' | 'admin-modo' | 'admin-super';
