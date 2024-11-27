import { DeleteObjectCommandOutput, PutObjectCommandOutput } from '@aws-sdk/client-s3';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { TestStatus } from '@dvsa/cvs-type-definitions/types/v1/enums/testStatus.enum';
import { DynamoDBRecord, SQSRecord } from 'aws-lambda';
import { Service } from 'typedi';
import { validate as uuidValidate } from 'uuid';
import { TestResultSchemaTestTypesAsObject } from '../models';
import { ERRORS } from '../models/Enums';
import { CertificateGenerationService } from '../services/CertificateGenerationService';
import { CertificateUploadService } from '../services/CertificateUploadService';

export type CertGenReturn = PutObjectCommandOutput | DeleteObjectCommandOutput;

@Service()
export class CertificateRequestProcessor {
	constructor(
		private certificateGenerationService: CertificateGenerationService,
		private certificateUploadService: CertificateUploadService
	) {}

	public async preProcessSnsPayload(record: SQSRecord): Promise<TestResultSchemaTestTypesAsObject[]> {
		let records: TestResultSchemaTestTypesAsObject[] = [];
		console.log(record);
		const dynamoRecord: DynamoDBRecord = JSON.parse(record.body) as DynamoDBRecord;
		console.log(dynamoRecord);
		if (
			dynamoRecord.eventName === 'INSERT' ||
			(dynamoRecord.eventName === 'MODIFY' && CertificateRequestProcessor.isProcessModifyEventsEnabled())
		) {
			if (dynamoRecord.dynamodb?.NewImage) {
				const unmarshalledRecord = unmarshall((dynamoRecord as any).dynamodb.NewImage);
				records = CertificateRequestProcessor.expandRecords(unmarshalledRecord);
			}
		} else {
			console.log('event name was not of correct type');
		}

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

	/**
	 * Returns true or false as a boolean based on PROCESS_MODIFY_EVENTS, if
	 * it is not a valid value then it should throw an error
	 */
	private static isProcessModifyEventsEnabled(): boolean {
		if (process.env.PROCESS_MODIFY_EVENTS !== 'true' && process.env.PROCESS_MODIFY_EVENTS !== 'false') {
			throw Error('PROCESS_MODIFY_EVENTS environment variable must be true or false');
		}
		return process.env.PROCESS_MODIFY_EVENTS === 'true';
	}

	private static expandRecords(record: any): TestResultSchemaTestTypesAsObject[] {
		const splitRecords: TestResultSchemaTestTypesAsObject[] = [];
		const templateRecord = Object.assign({}, record);
		Object.assign(templateRecord, {});
		if (Array.isArray(record.testTypes)) {
			record.testTypes?.forEach((testType: any, i: number, array: any[]) => {
				const clonedRecord: any = Object.assign({}, templateRecord); // Create record from template
				Object.assign(clonedRecord, { testTypes: testType }); // Assign it the test type
				Object.assign(clonedRecord, {
					// Assign certificate order number
					order: {
						current: i + 1,
						total: array.length,
					},
				});
				splitRecords.push(clonedRecord);
			});
		}
		console.log(splitRecords);

		return splitRecords.reduce((acc: any[], val: any) => acc.concat(val), []); // Flatten the array
	}
}
