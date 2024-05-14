import { Inject, Service } from 'typedi';
import { Readable } from 'stream';
import AWSXRay from 'aws-xray-sdk';
import {
  DeleteObjectCommand, DeleteObjectCommandOutput, GetObjectCommand, GetObjectCommandOutput, PutObjectCommand, PutObjectCommandOutput, S3Client,
} from '@aws-sdk/client-s3';
import { Configuration } from '../utils/Configuration';
import { IS3Config } from '../models/IS3Config';

/**
 * Service class for communicating with Simple Storage Service
 */
@Service()
class S3BucketService {
  public readonly s3Client: S3Client;

  constructor(@Inject() s3Client: S3Client) {
    const config: IS3Config = Configuration.getInstance().getS3Config();
    this.s3Client = AWSXRay.captureAWSv3Client(new S3Client({ ...s3Client, ...config }));
  }

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
    metadata?: Record<string, string>,
  ): Promise<PutObjectCommandOutput> {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: `${process.env.BRANCH}/${fileName}`,
      Body: content,
      Metadata: metadata,
    });

    return this.s3Client.send(command);
  }

  /**
   * Downloads a file from an S3 bucket
   * @param bucketName - the bucket from which to download
   * @param fileName - the name of the file
   */
  public download(
    bucketName: string,
    fileName: string,
  ): Promise<GetObjectCommandOutput> {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: `${process.env.BRANCH}/${fileName}`,
    });

    return this.s3Client.send(command);
  }

  /**
   * Deletes a file from an S3 bucket
   * @param bucketName - the bucket from which to download
   * @param fileName - the name of the file
   */
  public delete(
    bucketName: string,
    fileName: string,
  ): Promise<DeleteObjectCommandOutput> {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: `${process.env.BRANCH}/${fileName}`,
    });

    return this.s3Client.send(command);
  }
}

export { S3BucketService };
