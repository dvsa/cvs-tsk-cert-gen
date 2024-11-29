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

		return splitRecords.reduce((acc: any[], val: any) => acc.concat(val), []); // Flatten the array
	}
}

export { TestConvertorService };
