import { IInvokeConfig } from "../models";
import { Configuration } from "../utils/Configuration";
import { InvocationRequest, InvocationResponse, LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { Service } from "../models/injector/ServiceDecorator";
import { HTTPError } from "../models/HTTPError";
import { ERRORS } from "../models/Enums";

import AWSXRay from "aws-xray-sdk";

/**
 * Service class for invoking external lambda functions
 */
@Service()
class LambdaService {
  public readonly lambdaClient: LambdaClient;

  constructor(lambdaClient: LambdaClient) {
    const config: IInvokeConfig = Configuration.getInstance().getInvokeConfig();
    this.lambdaClient = AWSXRay.captureAWSv3Client(new LambdaClient({ ...lambdaClient, ...config.params }));
  }

  /**
   * Invokes a lambda function based on the given parameters
   * @param params - InvocationRequest params
   */
  public async invoke(
    params: InvocationRequest
  ): Promise<InvocationResponse> {
    return await this.lambdaClient.send(new InvokeCommand(params));
  }

  /**
   * Validates the invocation response
   * @param response - the invocation response
   */
  public validateInvocationResponse(
    response: InvocationResponse
  ): Promise<any> {
    // console.warn("payload", response.Payload);
    if (
      !response.Payload ||
      Buffer.from(response.Payload).toString() === "" ||
      (response.StatusCode && response.StatusCode >= 400)
    ) {
      throw new HTTPError(
        500,
        `${ERRORS.LAMBDA_INVOCATION_ERROR} ${response.StatusCode} ${ERRORS.EMPTY_PAYLOAD}`
      );
    }
    const payload: any = JSON.parse(Buffer.from(response.Payload).toString());
    console.warn("parsed payload", payload);
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
