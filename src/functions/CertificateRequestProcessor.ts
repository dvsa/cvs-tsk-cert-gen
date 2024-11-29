import { DeleteObjectCommandOutput, PutObjectCommandOutput } from '@aws-sdk/client-s3';
import { TestStatus } from '@dvsa/cvs-type-definitions/types/v1/enums/testStatus.enum';
import { Inject, Service } from 'typedi';
import { validate as uuidValidate } from 'uuid';
import { ITestResult } from '../models';
import { ERRORS } from '../models/Enums';
import { CertificateGenerationService } from '../services/CertificateGenerationService';
import { CertificateUploadService } from '../services/CertificateUploadService';

export type CertGenReturn = PutObjectCommandOutput | DeleteObjectCommandOutput;

@Service()
export class CertificateRequestProcessor {
	constructor(
		@Inject() private certificateGenerationService: CertificateGenerationService,
		@Inject() private certificateUploadService: CertificateUploadService
	) {}

	public async process(testResult: ITestResult): Promise<CertGenReturn> {
		const isCancelled = testResult.testStatus === TestStatus.CANCELLED;
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
		const response = await this.certificateGenerationService.generateCertificate(testResult);
		return this.certificateUploadService.uploadCertificate(response);
	}
}
