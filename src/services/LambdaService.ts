import {IInvokeConfig} from "../models";
import {Configuration} from "../utils/Configuration";
import {AWSError, config as AWSConfig, Lambda} from "aws-sdk";
import {Service} from "../models/injector/ServiceDecorator";
import {PromiseResult} from "aws-sdk/lib/request";

/**
 * Service class for invoking external lambda functions
 */
@Service()
class LambdaService {
    public readonly lambdaClient: Lambda;

    constructor(lambdaClient: Lambda) {
        const config: IInvokeConfig = Configuration.getInstance().getInvokeConfig();
        this.lambdaClient = lambdaClient;

        AWSConfig.lambda = config.params;
    }

    /**
     * Invokes a lambda function based on the given parameters
     * @param params - InvocationRequest params
     */
    public async invoke(params: Lambda.Types.InvocationRequest): Promise<PromiseResult<Lambda.Types.InvocationResponse, AWSError>> {
        return this.lambdaClient.invoke(params)
            .promise();
    }

    /**
     * Validates the invocation response
     * @param response - the invocation response
     */
    public validateInvocationResponse(response: Lambda.Types.InvocationResponse): Promise<any> {
        if (!response.Payload || response.Payload === "" || (response.StatusCode && response.StatusCode >= 400)) {
            throw new Error(`Lambda invocation returned error: ${response.StatusCode} with empty payload.`);
        }

        const payload: any = JSON.parse(response.Payload as string);

        if (payload.statusCode >= 400) {
            throw new Error(`Lambda invocation returned error: ${payload.statusCode} ${payload.body}`);
        }

        if (!payload.body) {
            throw new Error(`Lambda invocation returned bad data: ${JSON.stringify(payload)}.`);
        }

        return payload;
    }
}

export { LambdaService };
