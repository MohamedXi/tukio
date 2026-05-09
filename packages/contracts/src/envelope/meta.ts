export interface Meta {
  timestamp: string;
  correlationId: string;
  locale: 'fr' | 'en';
  version?: string;
  deprecation?: string;
  requestId?: string;
}
