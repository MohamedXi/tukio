/**
 * Validates a candidate next-redirect URL against an allowlist of base domains.
 *
 * Blocks: null/empty, non-https, javascript:, data:, external domains, and
 * relative paths. Only `https://[*.]{allowedDomain}` URLs pass.
 *
 * The gateway-api (Story 1.4a redirect-resolver) is the authoritative server-
 * side sanitizer. This client-side check is a defence-in-depth extra layer.
 */
export function sanitizeNextUrl(rawNext: string | null, allowedDomains: string[]): string | null {
  if (!rawNext) return null;

  let parsed: URL;
  try {
    parsed = new URL(rawNext);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:') return null;

  const { hostname } = parsed;
  if (!hostname) return null;

  const allowed = allowedDomains.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );

  return allowed ? rawNext : null;
}
