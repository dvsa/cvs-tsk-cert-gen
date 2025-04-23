import { InvocationRequest, InvocationResponse, InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { Inject, Service } from 'typedi';
import { ERRORS } from '../models/Enums';
import { HTTPError } from '../models/HTTPError';

/**
 * Service class for invoking external lambda functions
 */
@Service()
class LambdaService {
	constructor(@Inject() private lambdaClient: LambdaClient) {}

	/**
	 * Invokes a lambda function based on the given parameters
	 * @param params - InvocationRequest params
	 */
	public async invoke(params: InvocationRequest): Promise<InvocationResponse> {
		try {
			return await this.lambdaClient.send(new InvokeCommand(params));
		} catch (err) {
			throw err;
		}
	}

	/**
	 * Validates the invocation response
	 * @param response - the invocation response
	 */
	public validateInvocationResponse(response: InvocationResponse): Promise<any> {
		if (
			!response.Payload ||
			Buffer.from(response.Payload).toString() === '' ||
			(response.StatusCode && response.StatusCode >= 400)
		) {
			throw new HTTPError(500, `${ERRORS.LAMBDA_INVOCATION_ERROR} ${response.StatusCode} ${ERRORS.EMPTY_PAYLOAD}`);
		}

		const payload: any = JSON.parse(Buffer.from(response.Payload).toString());

		if (payload.statusCode >= 400) {
			throw new HTTPError(500, `${ERRORS.LAMBDA_INVOCATION_ERROR} ${payload.statusCode} ${payload.body}`);
		}

		if (!payload.body) {
			throw new HTTPError(400, `${ERRORS.LAMBDA_INVOCATION_BAD_DATA} ${JSON.stringify(payload)}.`);
		}

		return payload;
	}
}

export { LambdaService };
