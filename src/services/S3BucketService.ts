import S3, {Metadata} from "aws-sdk/clients/s3";
import {AWSError, config as AWSConfig} from "aws-sdk";
import {Service} from "../models/injector/ServiceDecorator";
import {Readable} from "stream";
import {Configuration} from "../utils/Configuration";
import {IS3Config} from "../models";
import {ManagedUpload} from "aws-sdk/lib/s3/managed_upload";
import {PromiseResult} from "aws-sdk/lib/request";
import SendData = ManagedUpload.SendData;


@Service()
class S3BucketService {
    public readonly s3Client: S3;

    constructor(s3Client: S3) {
        const config: IS3Config = Configuration.getInstance().getS3Config();
        this.s3Client = s3Client;

        AWSConfig.s3 = config;
    }

    public upload(bucketName: string, fileName: string, content: Buffer|Uint8Array|Blob|string|Readable, metadata?: Metadata): Promise<SendData> {
        return this.s3Client.upload({
            Bucket: bucketName,
            Key: fileName,
            Body: content,
            Metadata: metadata
        }).promise();
    }

    public download(bucketName: string, fileName: string): Promise<PromiseResult<S3.Types.GetObjectOutput, AWSError>> {
        return this.s3Client.getObject({
            Bucket: bucketName,
            Key: fileName,
        }).promise();
    }
}

export {S3BucketService};
