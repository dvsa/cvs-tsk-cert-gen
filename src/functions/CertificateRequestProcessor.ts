import { Service } from 'typedi';
import { DeleteObjectCommandOutput, PutObjectCommandOutput } from '@aws-sdk/client-s3';
import { validate as uuidValidate } from 'uuid';
import { CertificateGenerationService, IGeneratedCertificateResponse } from '../certificate/CertificateGenerationService';
import { CertificateUploadService } from '../certificate/CertificateUploadService';
import { ERRORS, TEST_RESULT_STATUS } from '../models/Enums';
import { ITestResult } from '../models/ITestResult';

export type CertGenReturn = PutObjectCommandOutput | DeleteObjectCommandOutput;

@Service()
export class CertificateRequestProcessor {
  constructor(private certificateGenerationService: CertificateGenerationService, private certificateUploadService: CertificateUploadService) {
  }

  public async process(testResult: ITestResult): Promise<CertGenReturn> {
    const isCancelled = testResult.testStatus === TEST_RESULT_STATUS.CANCELLED;
    if (isCancelled) {
      return this.remove(testResult);
    }

    const isValid = uuidValidate(testResult.testResultId);
    if (isValid) {
      return this.create(testResult);
    }

    console.error(`${ERRORS.TESTRESULT_ID}`, testResult.testResultId);
    throw new Error(`Bad Test Record: ${testResult.testResultId}`);
  }

  private async remove(testResult: ITestResult): Promise<DeleteObjectCommandOutput> {
    return this.certificateUploadService.removeCertificate(testResult);
  }

  private async create(testResult: ITestResult): Promise<PutObjectCommandOutput> {
    return this.certificateGenerationService
      .generateCertificate(testResult)
      .then((response: IGeneratedCertificateResponse) => this.certificateUploadService.uploadCertificate(response));
  }
}
