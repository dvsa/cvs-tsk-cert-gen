import { Inject, Service } from 'typedi';
import { DeleteObjectCommandOutput, PutObjectCommandOutput } from '@aws-sdk/client-s3';
import { validate as uuidValidate } from 'uuid';
import {
  CertificateGenerationService,
  IGeneratedCertificateResponse,
} from '../services/CertificateGenerationService';
import { CertificateUploadService } from '../services/CertificateUploadService';
import { ERRORS, TEST_RESULTS } from '../models/Enums';

export type CertGenReturn = PutObjectCommandOutput | DeleteObjectCommandOutput;

@Service()
export class CertificateRequestProcessor {
  private readonly certificateGenerationService: CertificateGenerationService;

  private readonly certificateUploadService: CertificateUploadService;

  constructor(@Inject() certificateGenerationService: CertificateGenerationService, @Inject() certificateUploadService: CertificateUploadService) {
    this.certificateGenerationService = certificateGenerationService;
    this.certificateUploadService = certificateUploadService;
  }

  public async process(testResult: any): Promise<CertGenReturn> {
    const isCancelled = testResult.testStatus === TEST_RESULTS.CANCELLED;
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

  private async remove(testResult: any): Promise<DeleteObjectCommandOutput> {
    return this.certificateUploadService.removeCertificate(testResult);
  }

  private async create(testResult: any): Promise<PutObjectCommandOutput> {
    return this.certificateGenerationService
      .generateCertificate(testResult)
      .then((response: IGeneratedCertificateResponse) => this.certificateUploadService.uploadCertificate(response));
  }
}
