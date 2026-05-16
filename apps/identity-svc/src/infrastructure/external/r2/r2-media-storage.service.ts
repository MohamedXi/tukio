import { Inject, Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type {
  IMediaStorage,
  MediaUploadInput,
  MediaUploadResult,
  SignedUrlInput,
  DeleteInput,
} from '../../../domain/ports/media-storage.port.js';
import {
  MediaStorageUploadError,
  MediaStorageNotFoundError,
} from '../../../domain/ports/media-storage.port.js';
import type { IConfigService } from '../../../domain/ports/config.port.js';
import { CONFIG_SERVICE } from '../../../domain/ports/tokens.js';

@Injectable()
export class R2MediaStorageService implements IMediaStorage {
  private readonly s3: S3Client;

  constructor(@Inject(CONFIG_SERVICE) config: IConfigService) {
    const r2 = config.getR2KycConfig();
    this.s3 = new S3Client({
      region: 'auto',
      endpoint: r2.endpoint,
      credentials: {
        accessKeyId: r2.accessKeyId,
        secretAccessKey: r2.secretAccessKey,
      },
      // Cloudflare R2 uses virtual-hosted-style URLs by default.
      forcePathStyle: false,
    });
  }

  async upload(input: MediaUploadInput): Promise<MediaUploadResult> {
    try {
      const result = await this.s3.send(
        new PutObjectCommand({
          Bucket: input.bucket,
          Key: input.key,
          Body: input.body,
          ContentType: input.contentType,
          ServerSideEncryption: 'AES256',
          Metadata: input.metadata,
        }),
      );
      return {
        key: input.key,
        etag: result.ETag ?? '',
      };
    } catch (err) {
      throw new MediaStorageUploadError(
        `Failed to upload object to R2: ${input.key}`,
        err,
      );
    }
  }

  async getSignedUrl(input: SignedUrlInput): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: input.bucket,
      Key: input.key,
    });
    try {
      return await getSignedUrl(this.s3, command, {
        expiresIn: input.ttlSeconds,
      });
    } catch (err) {
      // S3 SDK throws NoSuchKey when the object does not exist.
      const code =
        (err as { name?: string; Code?: string }).name ??
        (err as { Code?: string }).Code;
      if (code === 'NoSuchKey' || code === 'NotFound') {
        throw new MediaStorageNotFoundError(input.key);
      }
      throw new MediaStorageUploadError(
        `Failed to generate signed URL for R2 object: ${input.key}`,
        err,
      );
    }
  }

  async delete(input: DeleteInput): Promise<void> {
    try {
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: input.bucket,
          Key: input.key,
        }),
      );
    } catch (err) {
      throw new MediaStorageUploadError(
        `Failed to delete R2 object: ${input.key}`,
        err,
      );
    }
  }
}
