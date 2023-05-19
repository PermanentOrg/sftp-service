import fs from 'fs/promises';
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { v4 as uuid } from 'uuid';
import tmp from 'tmp';
import { SystemConfigurationError } from '../errors';
import type {
  CompletedPart,
} from '@aws-sdk/client-s3';
import type { FileResult } from 'tmp';

const S3_MINIMUM_UPLOAD_LENGTH = 5000000;

const enum FileState {
  UNINITIATED = 0,
  OPEN = 1,
  CLOSED = 2,
}

export class TemporaryFile {
  public readonly permanentFileSystemPath: string;

  private readonly bucket: string;

  private readonly key: string;

  private readonly localBuffer: FileResult;

  private readonly s3: S3Client;

  private readonly completedParts: CompletedPart[] = [];

  private state = FileState.UNINITIATED;

  private uploadedLength = 0;

  private localLength = 0;

  private s3Url?: string;

  private uploadId?: string;

  private nextPartNumber = 1;

  public constructor(permanentFileSystemPath: string) {
    if (process.env.TEMPORARY_FILE_S3_BUCKET === undefined) {
      throw new SystemConfigurationError('TEMPORARY_FILE_S3_BUCKET must be populated in order to upload to s3.');
    }
    if (process.env.AWS_ACCESS_KEY_ID === undefined) {
      throw new SystemConfigurationError('AWS_ACCESS_KEY_ID must be populated in order to upload to s3.');
    }
    if (process.env.AWS_ACCESS_SECRET === undefined) {
      throw new SystemConfigurationError('AWS_ACCESS_SECRET must be populated in order to upload to s3.');
    }
    if (process.env.TEMPORARY_FILE_S3_BUCKET_REGION === undefined) {
      throw new SystemConfigurationError('TEMPORARY_FILE_S3_BUCKET_REGION must be populated in order to upload to s3.');
    }
    this.localBuffer = tmp.fileSync();
    const path = `${process.env.TEMPORARY_FILE_S3_SUBDIRECTORY ?? ''}/unprocessed`;
    this.s3 = new S3Client({
      region: process.env.TEMPORARY_FILE_S3_BUCKET_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_ACCESS_SECRET,
      },
    });
    this.bucket = process.env.TEMPORARY_FILE_S3_BUCKET;
    this.key = `${path}/${uuid()}`;
    this.permanentFileSystemPath = permanentFileSystemPath;
  }

  public get url(): string {
    return this.s3Url ?? '';
  }

  public get size(): number {
    return this.uploadedLength + this.localLength;
  }

  public async open(): Promise<void> {
    if (this.state !== FileState.UNINITIATED) {
      throw new Error('Cannot open a file in an invalid file state.');
    }
    this.state = FileState.OPEN;

    const multipartUploadCommand = new CreateMultipartUploadCommand({
      Bucket: this.bucket,
      Key: this.key,
      ContentType: 'application/octet-stream',
    });
    const response = await this.s3.send(multipartUploadCommand);
    this.uploadId = response.UploadId;
  }

  public async append(fileData: Buffer): Promise<void> {
    if (this.state !== FileState.OPEN) {
      throw new Error('Cannot write to a file in an invalid file state.');
    }
    await fs.appendFile(
      this.localBuffer.name,
      fileData,
    );
    this.localLength += fileData.length;
    if (this.localLength >= S3_MINIMUM_UPLOAD_LENGTH) {
      await this.commitBufferToS3();
    }
  }

  public async close(): Promise<void> {
    if (this.state !== FileState.OPEN) {
      throw new Error('Cannot close a file in an invalid file state.');
    }
    this.state = FileState.CLOSED;

    if (this.localLength > 0) {
      await this.commitBufferToS3(true);
    }

    const completeMultipartUploadCommand = new CompleteMultipartUploadCommand({
      Bucket: this.bucket,
      Key: this.key,
      UploadId: this.uploadId,
      MultipartUpload: {
        Parts: this.completedParts,
      },
    });
    const result = await this.s3.send(completeMultipartUploadCommand);
    this.s3Url = decodeURIComponent(result.Location ?? '');
    this.localBuffer.removeCallback();
  }

  private async commitBufferToS3(isFinal = false): Promise<void> {
    const fileData = await fs.readFile(this.localBuffer.name);

    if (!isFinal && fileData.length < S3_MINIMUM_UPLOAD_LENGTH) {
      throw new Error('File is not large enough to upload to S3');
    }
    if (fileData.length === 0) {
      throw new Error('There is no data to upload');
    }

    const partNumber = this.nextPartNumber;
    this.nextPartNumber += 1;
    const uploadPartCommand = new UploadPartCommand({
      Bucket: this.bucket,
      Key: this.key,
      Body: fileData,
      UploadId: this.uploadId,
      PartNumber: partNumber,
    });

    const completedPart = await this.s3.send(uploadPartCommand);
    this.completedParts.push({
      ETag: completedPart.ETag,
      PartNumber: partNumber,
    });

    this.uploadedLength += fileData.length;
    this.localLength = 0;

    await fs.writeFile(
      this.localBuffer.name,
      Buffer.from([]),
    );
  }
}
