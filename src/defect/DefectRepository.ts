import { InvocationRequest, InvocationResponse } from '@aws-sdk/client-lambda';
import { toUint8Array } from '@smithy/util-utf8';
import { Inject, Service } from 'typedi';
import { IDefectParent, IInvokeConfig } from '../models';
import { ERRORS } from '../models/Enums';
import { HTTPError } from '../models/HTTPError';
import { LambdaService } from '../services/LambdaService';
import { Configuration } from '../utils/Configuration';

@Service()
export class DefectRepository {
	private readonly config: Configuration = Configuration.getInstance();

	constructor(@Inject() private lambdaClient: LambdaService) {}

	/**
	 * Method used to retrieve the Welsh translations for the certificates
	 * @returns a list of defects
	 */
	public async getDefectTranslations(): Promise<IDefectParent[]> {
		const config: IInvokeConfig = this.config.getInvokeConfig();
		const invokeParams: InvocationRequest = {
			FunctionName: config.functions.defects.name,
			InvocationType: 'RequestResponse',
			LogType: 'Tail',
			Payload: toUint8Array(
				JSON.stringify({
					httpMethod: 'GET',
					path: '/defects/',
				})
			),
		};
		let defects: IDefectParent[] = [];
		let retries = 0;
		while (retries < 3) {
			try {
				// eslint-disable-next-line no-await-in-loop
				const response: InvocationResponse = await this.lambdaClient.invoke(invokeParams);
				const payload: any = this.lambdaClient.validateInvocationResponse(response);
				const defectsParsed = JSON.parse(payload.body);

				if (!defectsParsed || defectsParsed.length === 0) {
					throw new HTTPError(400, `${ERRORS.LAMBDA_INVOCATION_BAD_DATA} ${JSON.stringify(payload)}.`);
				}
				defects = defectsParsed;
				return defects;
			} catch (error) {
				retries++;
				console.error(
					`There was an error retrieving the welsh defect translations on attempt ${retries}: ${(error as Error).message}`
				);
			}
		}
		return defects;
	}
}
