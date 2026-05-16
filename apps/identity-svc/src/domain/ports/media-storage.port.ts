/**
 * Domain-level error types thrown by `IMediaStorage` implementations. The
 * infrastructure adapter (Story 1.3b `R2MediaStorageService` wrapping
 * `@aws-sdk/client-s3`) translates SDK-specific errors to these so use cases
 * stay free of vendor types.
 */
export class MediaStorageUploadError extends Error {
  readonly underlyingError?: unknown;
  constructor(message: string, underlyingError?: unknown) {
    super(message);
    this.name = 'MediaStorageUploadError';
    this.underlyingError = underlyingError;
    Object.setPrototypeOf(this, MediaStorageUploadError.prototype);
  }
}

export class MediaStorageNotFoundError extends Error {
  constructor(key: string) {
    super(`Object not found in media storage: ${key}`);
    this.name = 'MediaStorageNotFoundError';
    Object.setPrototypeOf(this, MediaStorageNotFoundError.prototype);
  }
}

export interface MediaUploadInput {
  /** Bucket name. Buckets are pre-provisioned per environment (e.g. `tukio-kyc-staging`). */
  bucket: string;
  /** Object key under the bucket, e.g. `pro/<userProfileId>/id-card.jpg`. */
  key: string;
  /** Raw bytes to upload. */
  body: Buffer;
  /** MIME type stored as `Content-Type`. */
  contentType: string;
  /**
   * Optional caller-supplied metadata, mirrored as S3 user metadata (`x-amz-meta-*`).
   * Typically used to attach `actorId` and `documentType` so the admin queue
   * can identify ownership without re-reading the file body.
   */
  metadata?: Record<string, string>;
}

export interface MediaUploadResult {
  /** Object key under the bucket (mirrors `MediaUploadInput.key`). */
  key: string;
  /** Server-returned ETag for the uploaded object. */
  etag: string;
}

export interface SignedUrlInput {
  bucket: string;
  key: string;
  /** TTL in seconds for the pre-signed URL. Story 1.3 spec mandates 5 min (300 s). */
  ttlSeconds: number;
}

export interface DeleteInput {
  bucket: string;
  key: string;
}

/**
 * Port — S3-compatible media storage with server-side encryption.
 *
 * Adapters must request server-side encryption (`AES256` for R2) on every
 * `upload()` call. The infrastructure adapter is also responsible for
 * generating pre-signed URLs scoped to a single object and short TTL —
 * admin KYC review (Story 2.3-2.4) consumes those URLs to download files
 * without exposing long-lived bucket credentials.
 */
export interface IMediaStorage {
  upload(input: MediaUploadInput): Promise<MediaUploadResult>;
  getSignedUrl(input: SignedUrlInput): Promise<string>;
  delete(input: DeleteInput): Promise<void>;
}
