import { Counter, Registry } from 'prom-client';

/**
 * Prometheus metrics for the Cloudflare R2 KYC bucket (Story 1.3b R2 adapter
 * + Story 1.3d AC4 observability). Tracks upload outcomes and the number of
 * signed-URL minting calls so we can spot abnormal admin-review traffic
 * (e.g. a moderator pulling docs in a loop).
 */

export const r2KycMetricsRegistry = new Registry();

const R2_KYC_OUTCOMES = ['success', 'fail'] as const;
export type R2KycUploadOutcome = (typeof R2_KYC_OUTCOMES)[number];

export const r2KycUploadsTotal = new Counter({
  name: 'tukio_r2_kyc_uploads_total',
  help: 'Total R2 PUT operations against the KYC bucket by outcome.',
  labelNames: ['outcome'] as const,
  registers: [r2KycMetricsRegistry],
});
R2_KYC_OUTCOMES.forEach((outcome) => r2KycUploadsTotal.inc({ outcome }, 0));

export const r2KycSignedUrlsTotal = new Counter({
  name: 'tukio_r2_kyc_signed_urls_total',
  help: 'Total presigned GET URLs minted against the KYC bucket (admin review only).',
  registers: [r2KycMetricsRegistry],
});
// Counter with no labels — initialize at 0 so the series exists at boot.
r2KycSignedUrlsTotal.inc(0);
