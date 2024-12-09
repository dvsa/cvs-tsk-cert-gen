import { TestResults } from '@dvsa/cvs-type-definitions/types/v1/enums/testResult.enum';
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
		{
			if (!Array.isArray(record.testTypes)) {
				return [];
			}

			const expandedRecords = record.testTypes.map((testType: any, i: number) => ({
				...record,
				testTypes: testType,
				order: {
					current: i + 1,
					total: record.testTypes.length,
				},
			}));

			return TestConvertorService.filterCertificateGenerationRecords(expandedRecords);
		}
	}

	private static filterCertificateGenerationRecords(
		records: TestResultSchemaTestTypesAsObject[]
	): TestResultSchemaTestTypesAsObject[] {
		return records.filter((record: any) => {
			if (record.testStatus !== 'submitted') {
				return false;
			}

			const { testTypeClassification, testResult, requiredStandards } = record.testTypes;

			// Filter by testResult (abandoned tests are not allowed)
			if (![TestResults.PASS, TestResults.FAIL, TestResults.PRS].includes(testResult)) {
				return false;
			}

			// Filter by testTypeClassification or testTypeClassification, testResult and requiredStandards present and populated
			if (testTypeClassification === 'Annual With Certificate') {
				return true;
			}

			if (['IVA With Certificate', 'MSVA With Certificate'].includes(testTypeClassification)) {
				return testResult === 'fail' && requiredStandards?.length;
			}

			return false;
		});
	}
}

export { TestConvertorService };
