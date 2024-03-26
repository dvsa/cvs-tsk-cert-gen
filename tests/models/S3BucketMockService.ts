import { GetObjectCommandOutput, PutObjectCommand, PutObjectCommandOutput, S3Client } from "@aws-sdk/client-s3";
import { Readable } from "stream";
import * as fs from "fs";
import * as path from "path";
import { mockClient } from "aws-sdk-client-mock";

interface IBucket {
  bucketName: string;
  files: string[];
}

/**
 * Service for mocking the S3BucketService
 */
class S3BucketMockService {
  public static buckets: IBucket[] = [];

  /**
   * Uploads a file to an S3 bucket
   * @param bucketName - the bucket to upload to
   * @param fileName - the name of the file
   * @param content - contents of the file
   * @param metadata - optional metadata
   */
  public async upload(
    bucketName: string,
    fileName: string,
    content: Buffer | Uint8Array | Blob | string | Readable,
    metadata?: Record<string, string>
  ): Promise<PutObjectCommandOutput> {
    const mockS3Client = mockClient(S3Client);
    const s3 = new S3Client({});

    const bucket: IBucket | undefined = S3BucketMockService.buckets.find(
      (currentBucket: IBucket) => {
        return currentBucket.bucketName === bucketName;
      }
    );

    if (!bucket) {
      const error: Error = new Error();
      Object.assign(error, {
        message: "The specified bucket does not exist.",
        code: "NoSuchBucket",
        statusCode: 404,
        retryable: false,
      });

      throw error;
    }

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: `${process.env.BRANCH}/${fileName}`,
      Body: content,
      Metadata: metadata,
    });

    try {
      mockS3Client.on(PutObjectCommand).resolves({ ETag: `${process.env.BRANCH}/${fileName}` });
      return s3.send(command);
    } catch (err) {
      throw err;
    }
  }

  /**
   * Downloads a file from an S3 bucket
   * @param bucketName - the bucket from which to download
   * @param fileName - the name of the file
   */
  public async download(
    bucketName: string,
    fileName: string
  ): Promise<GetObjectCommandOutput> {
    const bucket: IBucket | undefined = S3BucketMockService.buckets.find(
      (currentBucket: IBucket) => {
        return currentBucket.bucketName === bucketName;
      }
    );

    if (!bucket) {
      const error: Error = new Error();
      Object.assign(error, {
        message: "The specified bucket does not exist.",
        code: "NoSuchBucket",
        statusCode: 404,
        retryable: false,
      });

      throw error;
    }

    // @ts-ignore
    const bucketKey: string | undefined = bucket.files.find(
      (currentFileName: string) => {
        return currentFileName === fileName;
      }
    );

    if (!bucketKey) {
      const error: Error = new Error();
      Object.assign(error, {
        message: "The specified key does not exist.",
        code: "NoSuchKey",
        statusCode: 404,
        retryable: false,
      });

      throw error;
    }

    const file: any = fs.readFileSync(
      path.resolve(__dirname, `../resources/signatures/${bucketKey}`)
    );
    const data: GetObjectCommandOutput = {
      Body: file,
      ContentLength: file.length,
      ETag: "621c9c14d75958d4c3ed8ad77c80cde1",
      LastModified: new Date(),
      $metadata: {},
    };

    return data;
  }
}

export { S3BucketMockService };
