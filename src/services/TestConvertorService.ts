import { Service } from 'typedi';
import { TestResultSchemaTestTypesAsObject } from '../models';

/**
 * Service class for converting dynamo tests into broken down single test type tests.
 */
@Service()
class TestConvertorService {
	constructor() {}

	public static isProcessModifyEventsEnabled(): boolean {
		if (process.env.PROCESS_MODIFY_EVENTS !== 'true' && process.env.PROCESS_MODIFY_EVENTS !== 'false') {
			throw Error('PROCESS_MODIFY_EVENTS environment variable must be true or false');
		}
		return process.env.PROCESS_MODIFY_EVENTS === 'true';
	}

	public static expandRecords(record: any): TestResultSchemaTestTypesAsObject[] {
		console.log('expanding records');
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

		const flatSplitRecords: TestResultSchemaTestTypesAsObject[] = splitRecords.reduce(
			(acc: any[], val: any) => acc.concat(val),
			[]
		);
		const filteredRecords = TestConvertorService.filterCertificateGenerationRecords(flatSplitRecords);

		return filteredRecords;
	}

	private static filterCertificateGenerationRecords(
		records: TestResultSchemaTestTypesAsObject[]
	): TestResultSchemaTestTypesAsObject[] {
		return records
			.filter((record: any) => {
				// Filter by testStatus
				return record.testStatus === 'submitted';
			})
			.filter((record: any) => {
				// Filter by testResult (abandoned tests are not allowed)
				return (
					record.testTypes.testResult === 'pass' ||
					record.testTypes.testResult === 'fail' ||
					record.testTypes.testResult === 'prs'
				);
			})
			.filter((record: any) => {
				// Filter by testTypeClassification or testTypeClassification, testResult and requiredStandards present and populated
				const { testTypeClassification, testResult, requiredStandards } = record.testTypes;
				const isTestResultFail = testResult === 'fail';
				const hasNonEmptyRequiredStandards = !!requiredStandards?.length;

				const isAnnualWithCertificate = testTypeClassification === 'Annual With Certificate';
				const isIvaWithCertificate =
					testTypeClassification === 'IVA With Certificate' && isTestResultFail && hasNonEmptyRequiredStandards;
				const isMsvaWithCertificate =
					testTypeClassification === 'MSVA With Certificate' && isTestResultFail && hasNonEmptyRequiredStandards;

				return isAnnualWithCertificate || isIvaWithCertificate || isMsvaWithCertificate;
			});
	}
}

export { TestConvertorService };
