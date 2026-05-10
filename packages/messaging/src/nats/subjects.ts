// NATS JetStream stream names and subject wildcards for Tukio.
// Subject format: tukio.<service>.<aggregate>.<event>.v<n>
// Stream wildcard: tukio.<service>.> captures all events from a service.

export const STREAMS = {
  TUKIO_IDENTITY: 'TUKIO_IDENTITY',
  TUKIO_CATALOG: 'TUKIO_CATALOG',
  TUKIO_BOOKING: 'TUKIO_BOOKING',
  TUKIO_PAYMENT: 'TUKIO_PAYMENT',
  TUKIO_ORDER: 'TUKIO_ORDER',
  TUKIO_MESSAGING: 'TUKIO_MESSAGING',
  TUKIO_REVIEW: 'TUKIO_REVIEW',
  TUKIO_NOTIFICATION: 'TUKIO_NOTIFICATION',
  TUKIO_MEDIA: 'TUKIO_MEDIA',
  TUKIO_DLQ: 'TUKIO_DLQ',
} as const;

export const SUBJECT_PREFIXES = {
  TUKIO_IDENTITY: 'tukio.identity',
  TUKIO_CATALOG: 'tukio.catalog',
  TUKIO_BOOKING: 'tukio.booking',
  TUKIO_PAYMENT: 'tukio.payment',
  TUKIO_ORDER: 'tukio.order',
  TUKIO_MESSAGING: 'tukio.messaging',
  TUKIO_REVIEW: 'tukio.review',
  TUKIO_NOTIFICATION: 'tukio.notification',
  TUKIO_MEDIA: 'tukio.media',
  TUKIO_DLQ: 'tukio.dlq',
} as const;

// Wildcard subjects bound to each stream.
export const STREAM_SUBJECTS: Record<string, string[]> = {
  TUKIO_IDENTITY: ['tukio.identity.>'],
  TUKIO_CATALOG: ['tukio.catalog.>'],
  TUKIO_BOOKING: ['tukio.booking.>'],
  TUKIO_PAYMENT: ['tukio.payment.>'],
  TUKIO_ORDER: ['tukio.order.>'],
  TUKIO_MESSAGING: ['tukio.messaging.>'],
  TUKIO_REVIEW: ['tukio.review.>'],
  TUKIO_NOTIFICATION: ['tukio.notification.>'],
  TUKIO_MEDIA: ['tukio.media.>'],
  TUKIO_DLQ: ['tukio.dlq.>'],
};
