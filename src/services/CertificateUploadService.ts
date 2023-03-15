import { Service } from "../models/injector/ServiceDecorator";
import { S3BucketService } from "./S3BucketService";
import { IGeneratedCertificateResponse } from "../models";
import { ManagedUpload, Metadata } from "aws-sdk/clients/s3";

/**
 * Service class for uploading certificates to S3
 */
@Service()
class CertificateUploadService {
  private readonly s3BucketService: S3BucketService;

  constructor(s3BucketService: S3BucketService) {
    this.s3BucketService = s3BucketService;
  }

  /**
   * Uploads a generated certificate to S3 bucket
   * @param payload
   */
  public uploadCertificate(
    payload: IGeneratedCertificateResponse
  ): Promise<ManagedUpload.SendData> {
    let shouldEmailCertificate = payload.shouldEmailCertificate;

    if (shouldEmailCertificate !== "false") {
      shouldEmailCertificate = "true";
    }

    const metadata: Metadata = {
      "vrm": payload.vrm,
      "test-type-name": payload.testTypeName,
      "test-type-result": payload.testTypeResult,
      "date-of-issue": payload.dateOfIssue,
      "cert-type": payload.certificateType,
      "file-format": payload.fileFormat,
      "file-size": payload.fileSize,
      "cert-index": payload.certificateOrder.current.toString(),
      "total-certs": payload.certificateOrder.total.toString(),
      "email": payload.email,
      "should-email-certificate": shouldEmailCertificate,
    };

    return this.s3BucketService.upload(
      `cvs-cert-${process.env.BUCKET}`,
      payload.fileName,
      payload.certificate,
      metadata
    );
  }

  public removeCertificate(testResult: any) {
    return this.s3BucketService.delete(`cvs-cert-${process.env.BUCKET}`, `${testResult.testTypes.testNumber}_${testResult.vin}.pdf`)
  }
}

export { CertificateUploadService };
