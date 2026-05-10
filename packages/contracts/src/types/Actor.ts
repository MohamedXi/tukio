import type { Locale } from './Locale.js';

export interface Actor {
  userId: string;
  role: 'client' | 'pro' | 'admin-support' | 'admin-modo' | 'admin-super' | 'system' | 'anonymous';
  locale: Locale;
}
