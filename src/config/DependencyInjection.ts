import { Container, Service } from 'typedi';
import { LambdaClient } from '@aws-sdk/client-lambda';
import * as AWSXRay from 'aws-xray-sdk';
import { S3Client } from '@aws-sdk/client-s3';
import { StandardRetryStrategy } from '@smithy/util-retry';
import { IInvokeConfig } from '../models/IInvokeConfig';
import { Configuration } from '../utils/Configuration';
import { TranslationService } from '../services/TranslationService';
import { TranslationServiceFake } from '../../tests/models/TranslationServiceFake';

@Service()
export class DependencyInjection {
  public static register() {
    const configInstance = Configuration.getInstance();
    const config = configInstance.getConfig();
    const invokeCconfig: IInvokeConfig = configInstance.getInvokeConfig();

    const retryStrategy = new StandardRetryStrategy(config.network.retryAttempts);

    Container.set(LambdaClient, AWSXRay.captureAWSv3Client(new LambdaClient({
      ...invokeCconfig.params,
      retryStrategy,
    })));

    Container.set(S3Client, AWSXRay.captureAWSv3Client(new S3Client({
      ...invokeCconfig,
      retryStrategy,
    })));

    const isOffline = (process.env.IS_OFFLINE ?? false) as boolean;
    if (isOffline) {
      Container.set(TranslationService, new TranslationServiceFake());

      // const SMC = new SecretsManagerClient({});

      // const command = new PutSecretValueCommand({
      //   SecretId: "secretid1",
      //   SecretString: JSON.stringify({
      //     accessKeyId: "accessKey1",
      //     secretAccessKey: "verySecretKey1"
      //   }),
      // });

      // SMC.send(command);

      // Container.set(SecretsManagerClient, SMC);
    }
  }
}
