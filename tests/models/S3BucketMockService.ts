import { Service } from "typedi";
import {GetObjectOutput, PutObjectCommandOutput} from "@aws-sdk/client-s3";
import {Readable} from "stream";
import * as fs from "fs";
import * as path from "path";

interface IBucket {
  bucketName: string;
  files: string[];
}

/**
 * Service for mocking the S3BucketService
 */
@Service()
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

    const response: any = {
      Bucket: bucketName,
      Key: `${process.env.BRANCH}/${fileName}`,
    };

    return response;
  }

  /**
   * Downloads a file from an S3 bucket
   * @param bucketName - the bucket from which to download
   * @param fileName - the name of the file
   */
  public async download(
      bucketName: string,
      fileName: string
  ): Promise<GetObjectOutput> {
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

    const fileContent: Buffer = fs.readFileSync(
        path.resolve(__dirname, `../resources/signatures/${bucketKey}`)
    );

    const stream = new Readable();
    stream.push(fileContent);
    stream.push(null);

    return {
      Body: stream,
      ContentLength: fileContent.length,
      ETag: "621c9c14d75958d4c3ed8ad77c80cde1",
      LastModified: new Date(),
      Metadata: {},
    };
  }
}


export { S3BucketMockService };
