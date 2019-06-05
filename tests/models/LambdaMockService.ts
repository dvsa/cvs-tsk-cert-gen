import {AWSError, Lambda, Response} from "aws-sdk";
import {PromiseResult} from "aws-sdk/lib/request";
import {Configuration} from "../../src/utils/Configuration";
import {IInvokeConfig} from "../../src/models";
import * as fs from "fs";
import * as path from "path";

interface IMockFunctions {
    functionName: string;
    response: string;
}

/**
 * Service for mocking the LambdaService
 */
class LambdaMockService {

    private static responses: IMockFunctions[] = [];


    /**
     * Populates the mock function responses
     */
    public static populateFunctions(): void {
        const invokeConfig: IInvokeConfig = Configuration.getInstance().getInvokeConfig();
        this.responses = Object.entries(invokeConfig.functions).map(([k, v]: [string, any]) => {
            return { functionName: v.name, response: fs.readFileSync(path.resolve(__dirname, `../../${v.mock}`)).toString() };
        });
    }

    /**
     * Purges the mock function responses
     */
    public static purgeFunctions(): void {
        this.responses = [];
    }

    /**
     * Invokes a lambda function based on the given parameters
     * @param params - InvocationRequest params
     */
    public async invoke(params: Lambda.Types.InvocationRequest): Promise<PromiseResult<Lambda.Types.InvocationResponse, AWSError>> {
        const mockFunction: IMockFunctions | undefined = LambdaMockService.responses.find((item: IMockFunctions) => item.functionName === params.FunctionName);
        if (!mockFunction) {
            const error: Error = new Error();
            Object.assign(error, {
                message: "Unsupported Media Type",
                code: "UnknownError",
                statusCode: 415,
                retryable: false
            });

            throw error;
        }

        const payload: any = mockFunction.response;
        const response = new Response<Lambda.Types.InvocationResponse, AWSError>();
        Object.assign(response, {
            data: {
                StatusCode: 200,
                Payload: payload
            }
        });

        return {
            $response: response,
            StatusCode: 200,
            Payload: payload
        };

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

        if (!payload.body) {
            throw new Error(`Lambda invocation returned bad data: ${JSON.stringify(payload)}.`);
        }

        return payload;
    }

}

export { LambdaMockService };
