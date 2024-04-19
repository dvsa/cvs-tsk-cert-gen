import { Service } from "../models/injector/ServiceDecorator";
import { Readable } from "stream";
import { Configuration } from "../utils/Configuration";
import { IS3Config } from "../models";
import AWSXRay from "aws-xray-sdk";
import { DeleteObjectCommand, DeleteObjectCommandOutput, GetObjectCommand, GetObjectCommandOutput, PutObjectCommand, PutObjectCommandOutput, S3Client } from "@aws-sdk/client-s3";

/**
 * Service class for communicating with Simple Storage Service
 */
@Service()
class S3BucketService {
  public readonly s3Client: S3Client;

  constructor(s3Client: S3Client) {
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
    metadata?: Record<string, string>
  ): Promise<PutObjectCommandOutput> {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: `${process.env.BRANCH}/${fileName}`,
      Body: content,
      Metadata: metadata,
    });

    try {
      return await this.s3Client.send(command);
    } catch (err) {
      throw err;
    }
  }

  /**
   * Downloads a file from an S3 bucket
   * @param bucketName - the bucket from which to download
   * @param fileName - the name of the file
   */
  public download(
    bucketName: string,
    fileName: string
  ): Promise<GetObjectCommandOutput> {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: `${process.env.BRANCH}/${fileName}`,
    });

    try {
      return this.s3Client.send(command);
    } catch (err) {
      throw err;
    }
  }

  /**
   * Deletes a file from an S3 bucket
   * @param bucketName - the bucket from which to download
   * @param fileName - the name of the file
   */
  public delete(
    bucketName: string,
    fileName: string
  ): Promise<DeleteObjectCommandOutput> {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: `${process.env.BRANCH}/${fileName}`,
    });

    try {
      return this.s3Client.send(command);
    } catch (err) {
      throw err;
    }
  }
}

export { S3BucketService };
