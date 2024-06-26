import { DeleteObjectCommandOutput, PutObjectCommandOutput } from "@aws-sdk/client-s3";
import { Callback, Context, Handler, SQSEvent, SQSRecord } from "aws-lambda";
import { ERRORS } from "../models/Enums";
import { Injector } from "../models/injector/Injector";
import {
  CertificateGenerationService,
  IGeneratedCertificateResponse,
} from "../services/CertificateGenerationService";
import { CertificateUploadService } from "../services/CertificateUploadService";

type CertGenReturn = PutObjectCommandOutput | DeleteObjectCommandOutput;

/**
 * λ function to process an SQS message detailing info for certificate generation
 * @param event - DynamoDB Stream event
 * @param context - λ Context
 * @param callback - callback function
 */
const certGen: Handler = async (
  event: SQSEvent,
  context?: Context,
  callback?: Callback
): Promise<CertGenReturn[]> => {
  if (
    !event ||
    !event.Records ||
    !Array.isArray(event.Records) ||
    !event.Records.length
  ) {
    console.error("ERROR: event is not defined.");
    throw new Error("Event is empty");
  }

  const certificateGenerationService: CertificateGenerationService =
    Injector.resolve<CertificateGenerationService>(
      CertificateGenerationService
    );
  const certificateUploadService: CertificateUploadService =
    Injector.resolve<CertificateUploadService>(CertificateUploadService);
  const certificateUploadPromises: Array<Promise<CertGenReturn>> = [];

  event.Records.forEach((record: SQSRecord) => {
    const testResult: any = JSON.parse(record.body);
    console.log(`parsed test result is ${testResult.testResultId} with the system number ${testResult.systemNumber}`);
    if (testResult.testStatus === "cancelled") {
      const s3DeletePromise =
        certificateUploadService.removeCertificate(testResult);
      certificateUploadPromises.push(s3DeletePromise);
    } else if (
      testResult.testResultId.match(
        "\\b[a-zA-Z0-9]{8}\\b-\\b[a-zA-Z0-9]{4}\\b-\\b[a-zA-Z0-9]{4}\\b-\\b[a-zA-Z0-9]{4}\\b-\\b[a-zA-Z0-9]{12}\\b"
      )
    ) {
      // Check for retroError flag for a testResult and cvsTestUpdated for the test-type and do not generate certificates if set to true
      const generatedCertificateResponse: Promise<PutObjectCommandOutput> =
        certificateGenerationService
          .generateCertificate(testResult)
          .then((response: IGeneratedCertificateResponse) => {
            return certificateUploadService.uploadCertificate(response);
          });

      certificateUploadPromises.push(generatedCertificateResponse);
    } else {
      console.error(`${ERRORS.TESTRESULT_ID}`, testResult.testResultId);
      throw new Error("Bad Test Record: " + testResult.testResultId);
    }
  });

  return Promise.all(certificateUploadPromises).catch((error: Error) => {
    console.error(error);
    throw error;
  });
};

export { certGen };
