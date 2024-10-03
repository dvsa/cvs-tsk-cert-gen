import { LambdaClient } from '@aws-sdk/client-lambda';
import { S3Client } from '@aws-sdk/client-s3';
import * as AWSXRay from 'aws-xray-sdk';
import { Container, Service } from 'typedi';
import { IInvokeConfig, IS3Config } from '../models';
import { Configuration } from '../utils/Configuration';

@Service()
export class DependencyInjection {
	public static register() {
		const invokeConfig: IInvokeConfig = Configuration.getInstance().getInvokeConfig();
		const s3Config: IS3Config = Configuration.getInstance().getS3Config();

		Container.set(LambdaClient, AWSXRay.captureAWSv3Client(new LambdaClient(invokeConfig.params)));
		Container.set(S3Client, AWSXRay.captureAWSv3Client(new S3Client(s3Config)));

		const isOffline = (process.env.IS_OFFLINE ?? false) as boolean;
		if (isOffline) {
			// Needed for later.
		}
	}
}
