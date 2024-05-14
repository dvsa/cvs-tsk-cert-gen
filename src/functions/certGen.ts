import { Inject, Service, Container } from 'typedi';
import {
  Callback, Context, Handler, SQSEvent, SQSRecord,
} from 'aws-lambda';
import { DeleteObjectCommandOutput, PutObjectCommandOutput } from '@aws-sdk/client-s3';
import { validate as uuidValidate } from 'uuid';
import {
  CertificateGenerationService,
  IGeneratedCertificateResponse,
} from '../services/CertificateGenerationService';
import { CertificateUploadService } from '../services/CertificateUploadService';
import { ERRORS, TEST_RESULTS } from '../models/Enums';

export type CertGenReturn = PutObjectCommandOutput | DeleteObjectCommandOutput;

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

  const certificateGenerationService = Container.get(CertificateGenerationService);
  const certificateUploadService = Container.get(CertificateUploadService);
  const certificateUploadPromises: Array<Promise<CertGenReturn>> = [];

  event.Records.forEach((record: SQSRecord) => {
    const testResult: any = JSON.parse(record.body);
    if (testResult.testStatus === TEST_RESULTS.CANCELLED) {
      const s3DeletePromise = certificateUploadService.removeCertificate(testResult);
      certificateUploadPromises.push(s3DeletePromise);
    } else if (uuidValidate(testResult.testResultId)) {
      // Check for retroError flag for a testResult and cvsTestUpdated for the test-type and do not generate certificates if set to true
      const generatedCertificateResponse: Promise<PutObjectCommandOutput> = certificateGenerationService
        .generateCertificate(testResult)
        .then((response: IGeneratedCertificateResponse) => certificateUploadService.uploadCertificate(response));

      certificateUploadPromises.push(generatedCertificateResponse);
    } else {
      console.error(`${ERRORS.TESTRESULT_ID}`, testResult.testResultId);
      throw new Error(`Bad Test Record: ${testResult.testResultId}`);
    }
  });

  return Promise.all(certificateUploadPromises).catch((error: Error) => {
    console.error(error);
    throw error;
  });
};

export { certGen };
