import 'reflect-metadata';

import { Container } from 'typedi';
import {
  Callback, Context, Handler, SQSBatchItemFailure, SQSEvent, SQSRecord,
} from 'aws-lambda';
import { DeleteObjectCommandOutput, PutObjectCommandOutput } from '@aws-sdk/client-s3';
import { CertGenReturn, CertificateRequestProcessor } from './CertificateRequestProcessor';

/**
 * λ function to process an SQS message detailing info for certificate generation
 * @param event - DynamoDB Stream event
 * @param context - λ Context
 * @param callback - callback function
 */
const certGen: Handler = async (event: SQSEvent, context?: Context, callback?: Callback): Promise<CertGenReturn[]> => {
  if (!event?.Records?.length) {
    console.error('ERROR: event is not defined.');
    throw new Error('Event is empty');
  }

  const processRequest = Container.get(CertificateRequestProcessor);
  const certificateUploadPromises = event.Records.map((record: SQSRecord) => processRequest.process(JSON.parse(record.body)));

  return Promise
    .all(certificateUploadPromises)
    .catch((error: Error) => {
      console.error(error);
      throw error;
    });
};

export { certGen };
