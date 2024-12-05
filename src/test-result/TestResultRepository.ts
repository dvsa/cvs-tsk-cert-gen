import { InvocationRequest, InvocationResponse, ServiceException } from '@aws-sdk/client-lambda';
import { TestResultSchema, TestTypeSchema } from '@dvsa/cvs-type-definitions/types/v1/test-result';
import { toUint8Array } from '@smithy/util-utf8';
import moment from 'moment';
import { Inject, Service } from 'typedi';
import { IInvokeConfig } from '../models';
import { ERRORS } from '../models/Enums';
import { HTTPError } from '../models/HTTPError';
import { LambdaService } from '../services/LambdaService';
import { Configuration } from '../utils/Configuration';

@Service()
export class TestResultRepository {
	private readonly config: Configuration = Configuration.getInstance();

	constructor(@Inject() private lambdaClient: LambdaService) {}

	/**
	 * Retrieves the odometer history for a given VIN from the Test Results microservice
	 * @param systemNumber - systemNumber for which to retrieve odometer history
	 */
	public async getOdometerHistory(systemNumber: string) {
		const config: IInvokeConfig = this.config.getInvokeConfig();
		const invokeParams: InvocationRequest = {
			FunctionName: config.functions.testResults.name,
			InvocationType: 'RequestResponse',
			LogType: 'Tail',
			Payload: toUint8Array(
				JSON.stringify({
					httpMethod: 'GET',
					path: `/test-results/${systemNumber}`,
					pathParameters: {
						systemNumber,
					},
				})
			),
		};

		return this.lambdaClient
			.invoke(invokeParams)
			.then((response: InvocationResponse) => {
				const payload: any = this.lambdaClient.validateInvocationResponse(response);
				const testResults: TestResultSchema[] = JSON.parse(payload.body);

				if (!testResults || testResults.length === 0) {
					throw new HTTPError(400, `${ERRORS.LAMBDA_INVOCATION_BAD_DATA} ${JSON.stringify(payload)}.`);
				}
				// Sort results by testEndTimestamp
				testResults.sort((first: any, second: any): number => {
					if (moment(first.testEndTimestamp).isBefore(second.testEndTimestamp)) {
						return 1;
					}

					if (moment(first.testEndTimestamp).isAfter(second.testEndTimestamp)) {
						return -1;
					}

					return 0;
				});

				// Remove the first result as it should be the current one.
				testResults.shift();

				// Set the array to only submitted tests (exclude cancelled)
				const submittedTests = testResults.filter((testResult) => testResult.testStatus === 'submitted');

				const filteredTestResults = submittedTests
					.filter(({ testTypes }) =>
						testTypes?.some(
							(testType: TestTypeSchema) =>
								testType.testTypeClassification === 'Annual With Certificate' &&
								(testType.testResult === 'pass' || testType.testResult === 'prs')
						)
					)
					.slice(0, 3); // Only last three entries are used for the history.

				return {
					OdometerHistoryList: filteredTestResults.map((testResult) => ({
						value: testResult.odometerReading,
						unit: testResult.odometerReadingUnits,
						date: moment(testResult.testEndTimestamp).format('DD.MM.YYYY'),
					})),
				};
			})
			.catch((error: ServiceException | Error) => {
				console.log(error);
				throw error;
			});
	}
}
