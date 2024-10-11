import { LambdaClient } from '@aws-sdk/client-lambda';
import { S3Client } from '@aws-sdk/client-s3';
import { StandardRetryStrategy } from '@smithy/util-retry';
import * as AWSXRay from 'aws-xray-sdk';
import { Container, Service } from 'typedi';
import { IInvokeConfig, IS3Config } from '../models';
import { Configuration } from '../utils/Configuration';

@Service()
export class DependencyInjection {
	public static register() {
		const configInstance = Configuration.getInstance();
		const config = configInstance.getConfig();
		const invokeConfig: IInvokeConfig = configInstance.getInvokeConfig();
		const s3Config: IS3Config = configInstance.getS3Config();

		const retryStrategy = new StandardRetryStrategy(config.network.retryAttempts);

		Container.set(
			LambdaClient,
			AWSXRay.captureAWSv3Client(
				new LambdaClient({
					...invokeConfig.params,
					retryStrategy,
				})
			)
		);

		Container.set(
			S3Client,
			AWSXRay.captureAWSv3Client(
				new S3Client({
					...s3Config,
					retryStrategy,
				})
			)
		);

		const isOffline = (process.env.IS_OFFLINE ?? false) as boolean;
		if (isOffline) {
			// Needed for later.
		}
	}
}
