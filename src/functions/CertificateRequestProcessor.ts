import { DeleteObjectCommandOutput, PutObjectCommandOutput } from '@aws-sdk/client-s3';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { TestStatus } from '@dvsa/cvs-type-definitions/types/v1/enums/testStatus.enum';
import { DynamoDBRecord, SQSRecord } from 'aws-lambda';
import { Inject, Service } from 'typedi';
import { validate as uuidValidate } from 'uuid';
import { TestResultSchemaTestTypesAsObject } from '../models';
import { ERRORS } from '../models/Enums';
import { CertificateGenerationService } from '../services/CertificateGenerationService';
import { CertificateUploadService } from '../services/CertificateUploadService';
import { TestConvertorService } from '../services/TestConvertorService';

export type CertGenReturn = PutObjectCommandOutput | DeleteObjectCommandOutput;

@Service()
export class CertificateRequestProcessor {
	constructor(
		@Inject() private certificateGenerationService: CertificateGenerationService,
		@Inject() private certificateUploadService: CertificateUploadService
	) {}

	public async preProcessPayload(record: SQSRecord): Promise<TestResultSchemaTestTypesAsObject[]> {
		console.log('pre processing SNS payload');
		let records: TestResultSchemaTestTypesAsObject[] = [];
		const dynamoRecord: DynamoDBRecord = JSON.parse(record.body) as DynamoDBRecord;

		if (
			dynamoRecord.eventName === 'INSERT' ||
			(dynamoRecord.eventName === 'MODIFY' && TestConvertorService.isProcessModifyEventsEnabled())
		) {
			if (dynamoRecord.dynamodb?.NewImage) {
				const unmarshalledRecord = unmarshall((dynamoRecord as any).dynamodb.NewImage);
				records = TestConvertorService.expandRecords(unmarshalledRecord);
			}
		} else {
			console.log('event name was not of correct type');
		}

		console.log(`found ${records.length} for ${record.messageId}`);
		return records;
	}

	public async process(testResult: TestResultSchemaTestTypesAsObject): Promise<CertGenReturn> {
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

	private async remove(testResult: TestResultSchemaTestTypesAsObject): Promise<DeleteObjectCommandOutput> {
		return this.certificateUploadService.removeCertificate(testResult);
	}

	private async create(testResult: TestResultSchemaTestTypesAsObject): Promise<PutObjectCommandOutput> {
		const response = await this.certificateGenerationService.generateCertificate(testResult);
		return this.certificateUploadService.uploadCertificate(response);
	}
}
