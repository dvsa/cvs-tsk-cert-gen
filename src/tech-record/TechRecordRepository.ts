import { InvocationRequest } from '@aws-sdk/client-lambda';
import { toUint8Array } from '@smithy/util-utf8';
import { Service } from 'typedi';
import { IInvokeConfig } from '../models';
import { TechRecordGet, TechRecordType } from '../models/Types';
import { LambdaService } from '../services/LambdaService';
import { Configuration } from '../utils/Configuration';

/*
 * Enables management of technical records.
 */
@Service()
export class TechRecordRepository {
	private readonly config: Configuration = Configuration.getInstance();

	constructor(private lambdaClient: LambdaService) {}

	/**
	 * Used to get a singular whole technical record.
	 * @param systemNumber
	 * @param createdTimestamp
	 */
	public callGetTechRecords = async <T extends TechRecordGet['techRecord_vehicleType']>(
		systemNumber: string,
		createdTimestamp: string
	): Promise<TechRecordType<T> | undefined> => {
		const config: IInvokeConfig = this.config.getInvokeConfig();
		const invokeParams: InvocationRequest = {
			FunctionName: config.functions.techRecords.name,
			InvocationType: 'RequestResponse',
			LogType: 'Tail',
			Payload: toUint8Array(
				JSON.stringify({
					httpMethod: 'GET',
					path: `/v3/technical-records/${systemNumber}/${createdTimestamp}`,
					pathParameters: {
						systemNumber,
						createdTimestamp,
					},
				})
			),
		};

		try {
			const lambdaResponse = await this.lambdaClient.invoke(invokeParams);
			const res = await this.lambdaClient.validateInvocationResponse(lambdaResponse);
			return JSON.parse(res.body);
		} catch (e) {
			console.log('Error in get technical record');
			console.log(JSON.stringify(e));
			return undefined;
		}
	};
}
