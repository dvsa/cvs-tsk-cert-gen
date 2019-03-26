import {Callback, Context, Handler} from "aws-lambda";
import {Injector} from "../models/injector/Injector";
import {ManagedUpload} from "aws-sdk/clients/s3";
import {CertificateGenerationService, IGeneratedCertificateResponse} from "../services/CertificateGenerationService";
import {AWSError} from "aws-sdk";
import {CertificateUploadService} from "../services/CertificateUploadService";

/**
 * λ function to process an SQS message detailing info for certificate generation
 * @param event - DynamoDB Stream event
 * @param context - λ Context
 * @param callback - callback function
 */
const certGen: Handler = async (event: any, context?: Context, callback?: Callback): Promise<void | ManagedUpload.SendData[]> => {
    if (!event) {
        console.error("ERROR: event is not defined.");
        return;
    }

    const certificateGenerationService: CertificateGenerationService = Injector.resolve<CertificateGenerationService>(CertificateGenerationService);
    const certificateUploadService: CertificateUploadService = Injector.resolve<CertificateUploadService>(CertificateUploadService);
    const certificateUploadPromises: Array<Promise<ManagedUpload.SendData>> = [];

    event.Records.forEach(async (record: any) => {
        const testResult: any = JSON.parse(record.body);
        const generatedCertificateResponse: Promise<ManagedUpload.SendData> = certificateGenerationService.generateCertificate(testResult)
        .then((response: IGeneratedCertificateResponse) => {
            return certificateUploadService.uploadCertificate(response);
        });

        certificateUploadPromises.push(generatedCertificateResponse);
    });

    return Promise.all(certificateUploadPromises)
    .catch((error: AWSError) => {
        console.error(error);
    });
};

export {certGen};
