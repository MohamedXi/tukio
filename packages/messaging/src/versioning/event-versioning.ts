export interface ParsedEventType {
  service: string;
  aggregate?: string;
  event: string;
  version: 'v1' | 'v2';
}

// Parses eventType strings following the format:
//   <service>.<aggregate>.<event>.v<n>   → 4 segments
//   <service>.<event>.v<n>               → 3 segments (no aggregate)
// Example: 'catalog.listing.published.v1' → { service:'catalog', aggregate:'listing', event:'published', version:'v1' }
// Example: 'booking.requested.v1' → { service:'booking', event:'requested', version:'v1' }
export function parseEventType(eventType: string): ParsedEventType {
  const parts = eventType.split('.');
  if (parts.length < 3) {
    throw new Error(
      `Invalid eventType format: "${eventType}". Expected <service>.<event>.v<n> or <service>.<aggregate>.<event>.v<n>`,
    );
  }
  const version = parts.at(-1) as string;
  if (!/^v[12]$/.test(version)) {
    throw new Error(
      `Unsupported version in eventType: "${version}". Only v1 and v2 are supported.`,
    );
  }
  const service = parts[0] as string;
  if (parts.length === 3) {
    return { service, event: parts[1] as string, version: version as 'v1' | 'v2' };
  }
  return {
    service,
    aggregate: parts.slice(1, -2).join('.'),
    event: parts.at(-2) as string,
    version: version as 'v1' | 'v2',
  };
}

export function isCompatibleVersion(
  eventType: string,
  supportedVersions: ('v1' | 'v2')[],
): boolean {
  try {
    const parsed = parseEventType(eventType);
    return supportedVersions.includes(parsed.version);
  } catch {
    return false;
  }
}

// Migrates a v1 event payload to v2 in-memory using a provided mapper.
// Used by consumers that need to handle legacy v1 events alongside newer v2 events.
export function migrateEventV1ToV2<V1Payload, V2Payload>(
  payload: V1Payload,
  mapper: (v1: V1Payload) => V2Payload,
): V2Payload {
  return mapper(payload);
}
