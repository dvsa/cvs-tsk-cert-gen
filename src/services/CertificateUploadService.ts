import { ManagedUpload, Metadata } from 'aws-sdk/clients/s3';
import { Service } from '../models/injector/ServiceDecorator';
import { S3BucketService } from './S3BucketService';
import { IGeneratedCertificateResponse } from '../models/index.d';

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
    payload: IGeneratedCertificateResponse,
  ): Promise<ManagedUpload.SendData> {
    let { shouldEmailCertificate } = payload;

    if (shouldEmailCertificate !== 'false') {
      shouldEmailCertificate = 'true';
    }

    const metadata: Metadata = {
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
      'should-email-certificate': shouldEmailCertificate,
    };

    const bucketName = process.env.BUCKET as string;
    return this.s3BucketService.upload(
      `cvs-cert-${bucketName}`,
      payload.fileName,
      payload.certificate,
      metadata,
    );
  }
}

export { CertificateUploadService };
