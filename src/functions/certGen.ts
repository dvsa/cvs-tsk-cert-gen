import {Callback, Context, Handler} from "aws-lambda";
import {Injector} from "../models/injector/Injector";
import {S3BucketService} from "../services/S3BucketService";
import {ManagedUpload, Metadata} from "aws-sdk/clients/s3";
import {CertificateGenerationService} from "../services/CertificateGenerationService";
import {AWSError} from "aws-sdk";
import moment from "moment";
import SendData = ManagedUpload.SendData;

/**
 * λ function to process a DynamoDB stream of test results into a queue for certificate generation.
 * @param event - DynamoDB Stream event
 * @param context - λ Context
 * @param callback - callback function
 */
const certGen: Handler = async (event: any, context?: Context, callback?: Callback): Promise<void | ManagedUpload.SendData[]> => {
    if (!event) {
        console.error("ERROR: event is not defined.");
        return;
    }

    const s3BucketService: S3BucketService = Injector.resolve<S3BucketService>(S3BucketService);
    const certificateUploadPromises: Array<Promise<SendData>> = [];

    event.Records.forEach((record: any) => {
        const testResult: any = JSON.parse(record.body);
        const certificate = CertificateGenerationService.generateCertificate(testResult);
        const certificateUploadPromise = certificate
        .then((response: { fileName: string, certificate: string, certificateType: string, certificateOrder: any }) => {
            const file: Buffer = Buffer.from(response.certificate, "base64");
            const metadata: Metadata = {
                "vrm": testResult.vrm,
                "test-type-name": testResult.testTypes.testTypeName,
                "test-type-result": testResult.testTypes.testResult,
                "date-of-issue": moment().format("D MMMM YYYY"),
                "cert-type": response.certificateType,
                "file-format": "pdf",
                "file-size": file.byteLength.toString(),
                "cert-index": response.certificateOrder.current.toString(),
                "total-certs": response.certificateOrder.total.toString()
            };

            return s3BucketService.upload("cvs-cert", response.fileName, file, metadata)
            .then((result: any) => {
                console.log(result);
                return result;
            });
        })
        .catch((error: any) => {
            console.log(error);
        });

        certificateUploadPromises.push(certificateUploadPromise);
    });

    return Promise.all(certificateUploadPromises)
    .catch((error: AWSError) => {
        console.error(error);
    });
};

export {certGen};
