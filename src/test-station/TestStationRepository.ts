import { InvocationRequest, InvocationResponse } from '@aws-sdk/client-lambda';
import { TestStationSchema } from '@dvsa/cvs-type-definitions/types/v1/test-station';
import { toUint8Array } from '@smithy/util-utf8';
import { Service } from 'typedi';
import { IInvokeConfig } from '../models';
import { LambdaService } from '../services/LambdaService';
import { Configuration } from '../utils/Configuration';

@Service()
export class TestStationRepository {
	private readonly config: Configuration = Configuration.getInstance();

	constructor(private lambdaClient: LambdaService) {}

	/**
	 * Method to retrieve Test Station details from API
	 * @returns a test station object
	 */
	public async getTestStation(testStationPNumber: string): Promise<TestStationSchema> {
		const config: IInvokeConfig = this.config.getInvokeConfig();
		const invokeParams: InvocationRequest = {
			FunctionName: config.functions.testStations.name,
			InvocationType: 'RequestResponse',
			LogType: 'Tail',
			Payload: toUint8Array(
				JSON.stringify({
					httpMethod: 'GET',
					path: `/test-stations/${testStationPNumber}`,
				})
			),
		};

		let testStation: TestStationSchema = {} as TestStationSchema;
		let retries = 0;

		while (retries < 3) {
			try {
				// eslint-disable-next-line no-await-in-loop
				const response: InvocationResponse = await this.lambdaClient.invoke(invokeParams);
				const payload: any = this.lambdaClient.validateInvocationResponse(response);

				testStation = JSON.parse(payload.body);

				return testStation;
			} catch (error) {
				retries++;
				console.error(
					`There was an error retrieving the test station on attempt ${retries}: ${(error as Error).message}`
				);
			}
		}
		return testStation;
	}
}
