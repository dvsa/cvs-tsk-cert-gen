import { VTG_VTP_12_TEST } from '@dvsa/cvs-microservice-common/classes/testTypes/Constants';
import { TestTypeHelper } from '@dvsa/cvs-microservice-common/classes/testTypes/testTypeHelper';
import { TestResults } from '@dvsa/cvs-type-definitions/types/v1/enums/testResult.enum';
import { Service } from 'typedi';
import { CertificateRequestProcessor } from '../functions/CertificateRequestProcessor';
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

			if (testResult === TestResults.ABANDONED) {
				return (
					TestConvertorService.shouldGenerateAbandonedCerts() &&
					TestConvertorService.isValidForAbandonedCertificate(record.testTypes.testTypeId)
				);
			}

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

	/**
	 * Check the flag to see if abandoned certificates should be generated
	 */
	public static shouldGenerateAbandonedCerts(): boolean {
		if (!CertificateRequestProcessor.flags.abandonedCerts.enabled) {
			console.warn(`Unable to generate abandoned certificates: global abandoned certificates flag disabled.`);
			return false;
		}
		return true;
	}

	/**
	 * Check that the test type id is valid for an abandoned certificate
	 * @param testTypeId
	 */
	public static isValidForAbandonedCertificate(testTypeId: string): boolean {
		if (!TestTypeHelper.validateTestTypeIdInLists([VTG_VTP_12_TEST], testTypeId)) {
			console.warn(
				`Unable to generate abandoned certificates: test type id ${testTypeId} is not valid for abandoned certificates.`
			);
			return false;
		}
		return true;
	}
}

export { TestConvertorService };
