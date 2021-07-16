import { IInvokeConfig } from "../models";
import { Configuration } from "../utils/Configuration";
import { AWSError, config as AWSConfig, Lambda } from "aws-sdk";
import { Service } from "../models/injector/ServiceDecorator";
import { PromiseResult } from "aws-sdk/lib/request";
import { HTTPError } from "../models/HTTPError";
import { ERRORS } from "../models/Enums";
/* tslint:disable */
const AWSXRay = require("aws-xray-sdk");
/* tslint:enable */

/**
 * Service class for invoking external lambda functions
 */
@Service()
class LambdaService {
  public readonly lambdaClient: Lambda;

  constructor(lambdaClient: Lambda) {
    const config: IInvokeConfig = Configuration.getInstance().getInvokeConfig();
    this.lambdaClient = AWSXRay.captureAWSClient(lambdaClient);

    AWSConfig.lambda = config.params;
  }

  /**
   * Invokes a lambda function based on the given parameters
   * @param params - InvocationRequest params
   */
  public async invoke(
    params: Lambda.Types.InvocationRequest
  ): Promise<PromiseResult<Lambda.Types.InvocationResponse, AWSError>> {
    return this.lambdaClient.invoke(params).promise();
  }

  /**
   * Validates the invocation response
   * @param response - the invocation response
   */
  public validateInvocationResponse(
    response: Lambda.Types.InvocationResponse
  ): Promise<any> {
    if (
      !response.Payload ||
      response.Payload === "" ||
      (response.StatusCode && response.StatusCode >= 400)
    ) {
      throw new HTTPError(
        500,
        `${ERRORS.LAMBDA_INVOCATION_ERROR} ${response.StatusCode} ${ERRORS.EMPTY_PAYLOAD}`
      );
    }

    const payload: any = JSON.parse(response.Payload as string);

    if (payload.statusCode >= 400) {
      throw new HTTPError(
        500,
        `${ERRORS.LAMBDA_INVOCATION_ERROR} ${payload.statusCode} ${payload.body}`
      );
    }

    if (!payload.body) {
      throw new HTTPError(
        400,
        `${ERRORS.LAMBDA_INVOCATION_BAD_DATA} ${JSON.stringify(payload)}.`
      );
    }

    return payload;
  }
}

export { LambdaService };
