import S3 from "aws-sdk/clients/s3";
import {AWSError, config as AWSConfig} from "aws-sdk";
import {Service} from "../models/injector/ServiceDecorator";
import {Configuration} from "../utils/Configuration";
import {IS3Config} from "../models";
import {PromiseResult} from "aws-sdk/lib/request";

/**
 * Service class for communicating with Simple Storage Service
 */
@Service()
class S3BucketServiceDownload {
    public readonly s3Client: S3;

    constructor(s3Client: S3) {
        const config: IS3Config = Configuration.getInstance().getS3Config("cvs-signature");
        this.s3Client = s3Client;
        AWSConfig.s3 = config;
    }

    /**
     * Downloads a file from an S3 bucket
     * @param bucketName - the bucket from which to download
     * @param fileName - the name of the file
     */
    public download(bucketName: string, fileName: string): Promise<PromiseResult<S3.Types.GetObjectOutput, AWSError>> {
        return this.s3Client.getObject({
            Bucket: bucketName,
            Key: fileName,
        }).promise();
    }
}

export {S3BucketServiceDownload};
