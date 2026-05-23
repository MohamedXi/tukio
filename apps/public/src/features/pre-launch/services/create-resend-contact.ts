// Direct REST call to Resend `POST /contacts`.
//
// We bypass the SDK because resend@4.8 `CreateContactOptions` does not expose the
// `properties` field (per docs: https://resend.com/docs/api-reference/contacts/create-contact).
// The REST endpoint accepts a `properties` key-value map that lands in the Resend
// audience export (used by Brevo migration at launch, Epic 16.2).

interface CreateResendContactInput {
  audienceId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  properties?: Record<string, string>;
}

export type CreateResendContactResult =
  | { ok: true; id: string }
  | { ok: false; status: number; name: string; message: string };

const RESEND_API_URL = 'https://api.resend.com/contacts';

export async function createResendContact(
  input: CreateResendContactInput,
  apiKey: string,
): Promise<CreateResendContactResult> {
  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audience_id: input.audienceId,
      email: input.email,
      first_name: input.firstName,
      last_name: input.lastName,
      unsubscribed: false,
      ...(input.properties && Object.keys(input.properties).length > 0
        ? { properties: input.properties }
        : {}),
    }),
  });

  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      name: typeof body['name'] === 'string' ? body['name'] : 'unknown_error',
      message: typeof body['message'] === 'string' ? body['message'] : `Resend ${response.status}`,
    };
  }

  return {
    ok: true,
    id: typeof body['id'] === 'string' ? body['id'] : '',
  };
}

// A Resend error name that indicates the email is already in the audience.
// Resend currently uses 'validation_error' + a message containing 'already exists';
// covering both for forward-compat.
export function isResendDuplicateContact(name: string, message: string): boolean {
  const haystack = `${name} ${message}`.toLowerCase();
  return (
    haystack.includes('already exists') ||
    haystack.includes('contact_already_exists') ||
    name === 'duplicate'
  );
}
