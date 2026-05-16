import type { AcquisitionInputDto } from '@tukio/contracts/dtos/identity/acquisition';

/**
 * First-touch wins merge of acquisition attribution (Story 1.2c parent §11).
 *
 * The frontend middleware (Story 1.2d) writes the first inbound UTM combo to
 * the `tk_acq` cookie (base64-JSON, 90-day TTL, HttpOnly, SameSite=Lax). The
 * sign-up form may also embed an `acquisition` block in the request body — for
 * example a referral landing page that wants to override the cookie source.
 *
 * Rule : when both are present, the cookie wins (first-touch attribution); the
 * body is used only when no cookie exists or it fails to parse. Multi-touch
 * attribution is V1 (Story 7.5).
 */
export function mergeAcquisition(
  cookieValue: string | undefined,
  bodyAcquisition: AcquisitionInputDto | undefined,
): AcquisitionInputDto | undefined {
  const fromCookie = parseAcquisitionCookie(cookieValue);
  if (fromCookie) return fromCookie;
  return bodyAcquisition;
}

// P3 — limit cookie size to prevent large-buffer allocation DoS.
// A valid base64url tk_acq cookie for a full AcquisitionInputDto is well under
// 512 bytes; 2 048 chars is a generous upper bound that covers future fields.
const MAX_ACQUISITION_COOKIE_LENGTH = 2_048;

function parseAcquisitionCookie(
  raw: string | undefined,
): AcquisitionInputDto | undefined {
  if (!raw) return undefined;
  // P3 patch: reject oversized cookies before allocating a Buffer.
  if (raw.length > MAX_ACQUISITION_COOKIE_LENGTH) {
    console.warn(
      `[merge-acquisition] tk_acq cookie exceeds ${MAX_ACQUISITION_COOKIE_LENGTH} chars — ignoring`,
    );
    return undefined;
  }
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8');
    const parsed: unknown = JSON.parse(decoded);
    if (
      parsed &&
      typeof parsed === 'object' &&
      'source' in parsed &&
      typeof parsed.source === 'string'
    ) {
      return parsed as AcquisitionInputDto;
    }
    // P4 patch: log when the cookie decodes successfully but has an unexpected shape.
    console.warn(
      '[merge-acquisition] tk_acq cookie decoded but missing a string `source` field — ignoring',
    );
    return undefined;
  } catch {
    // P4 patch: log when the cookie cannot be decoded or parsed (tampered, stale).
    console.warn(
      '[merge-acquisition] tk_acq cookie could not be decoded (invalid base64url or JSON) — falling back to body',
    );
    return undefined;
  }
}
