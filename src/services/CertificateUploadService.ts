import { Service } from 'typedi';
import { PutObjectCommandOutput } from '@aws-sdk/client-s3';
import { S3BucketService } from './S3BucketService';
import { IGeneratedCertificateResponse } from '../models/IGeneratedCertificateResponse';
import { ITestResult } from '../models/ITestResult';

/**
 * Service class for uploading certificates to S3
 */
@Service()
class CertificateUploadService {
  constructor(private s3BucketService: S3BucketService) {
  }

  /**
   * Uploads a generated certificate to S3 bucket
   * @param payload
   */
  public uploadCertificate(payload: IGeneratedCertificateResponse): Promise<PutObjectCommandOutput> {
    const shouldEmailCertificate = payload?.shouldEmailCertificate !== 'false';

    const metadata: Record<string, string> = {
      vrm: payload.vrm,
      'test-type-name': payload.testTypeName,
      'test-type-result': payload.testTypeResult,
      'date-of-issue': payload.dateOfIssue,
      'cert-type': payload.certificateType,
      'file-format': payload.fileFormat,
      'file-size': payload.fileSize,
      'cert-index': payload.certificateOrder.current.toString(),
      'total-certs': payload.certificateOrder.total.toString(),
      email: payload.email,
      'should-email-certificate': shouldEmailCertificate.toString(),
    };

    return this.s3BucketService.upload(
      `cvs-cert-${process.env.BUCKET}`,
      payload.fileName,
      payload.certificate,
      metadata,
    );
  }

  /**
   * Deletes a generated certificate to S3 bucket
   * @param testResult
   */
  public removeCertificate(testResult: ITestResult) {
    return this.s3BucketService.delete(
      `cvs-cert-${process.env.BUCKET}`,
      `${testResult.testTypes.testNumber}_${testResult.vin}.pdf`,
    );
  }
}

export { CertificateUploadService };
