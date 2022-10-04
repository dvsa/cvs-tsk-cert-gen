import { config as AWSConfig } from 'aws-sdk';
import { certGen } from './functions/certGen';

const isOffline: boolean =
  !process.env.BRANCH || process.env.BRANCH === 'local';

if (isOffline) {
  AWSConfig.credentials = {
    accessKeyId: 'accessKey1',
    secretAccessKey: 'verySecretKey1',
  };
}

export { certGen as handler };
