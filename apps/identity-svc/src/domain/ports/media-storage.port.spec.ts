import {
  MediaStorageUploadError,
  MediaStorageNotFoundError,
} from './media-storage.port.js';

describe('MediaStorageUploadError', () => {
  it('stores the message and optional underlying error', () => {
    const underlying = new Error('S3 connection refused');
    const err = new MediaStorageUploadError('R2 upload failed', underlying);
    expect(err.message).toBe('R2 upload failed');
    expect(err.underlyingError).toBe(underlying);
    expect(err.name).toBe('MediaStorageUploadError');
    expect(err).toBeInstanceOf(MediaStorageUploadError);
  });

  it('accepts no underlying error', () => {
    const err = new MediaStorageUploadError('R2 timeout');
    expect(err.underlyingError).toBeUndefined();
  });
});

describe('MediaStorageNotFoundError', () => {
  it('includes the object key in the error message', () => {
    const err = new MediaStorageNotFoundError('pro/123/id-card.jpg');
    expect(err.message).toContain('pro/123/id-card.jpg');
    expect(err.name).toBe('MediaStorageNotFoundError');
    expect(err).toBeInstanceOf(MediaStorageNotFoundError);
  });
});
