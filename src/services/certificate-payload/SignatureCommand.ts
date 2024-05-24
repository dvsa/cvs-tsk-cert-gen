import { Service } from 'typedi';
import { ICertificatePayload } from '../../models/ICertificatePayload';
import { ITestResult } from '../../models/ITestResult';
import { S3BucketService } from '../S3BucketService';
import { GetObjectCommandOutput } from '@aws-sdk/client-s3';
import { ServiceException } from '@aws-sdk/client-lambda';
import { ICertificatePayloadGenerator } from '../ICertificatePayloadGenerator';
import { CERTIFICATE_DATA } from '../../models/Enums';

@Service()
export class SignatureCommand implements ICertificatePayloadGenerator {
  constructor(private s3Client: S3BucketService) {
    this.s3Client = s3Client;
  }

  initialise(type: CERTIFICATE_DATA, isWelsh: boolean = false) {
  }

  public async generate(testResult: ITestResult): Promise<ICertificatePayload> {
    const result = {} as ICertificatePayload;

    const signature = await this.getSignature((testResult as any).createdById ?? testResult.testerStaffId);

    result.Signature = {
      ImageType: 'png',
      ImageData: signature,
    };

    return result;
  }

  /**
   * Retrieves a signature from the cvs-signature S3 bucket
   * @param staffId - staff ID of the signature you want to retrieve
   * @returns the signature as a base64 encoded string
   */
  private async getSignature(staffId: string): Promise<string | null> {
    return this.s3Client
      .download(`cvs-signature-${process.env.BUCKET}`, `${staffId}.base64`)
      .then((result: GetObjectCommandOutput) => result.Body!.transformToString())
      .catch((error: ServiceException) => {
        console.error(`Unable to fetch signature for staff id ${staffId}. ${error.message}`);
        return null;
      });
  }
}
