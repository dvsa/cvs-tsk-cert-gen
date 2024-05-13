import { ServiceException } from '@smithy/smithy-client';
import { InvocationRequest, InvocationResponse } from '@aws-sdk/client-lambda';
import * as fs from 'fs';
import * as path from 'path';
import { Configuration } from '../../src/utils/Configuration';
import { IInvokeConfig } from '../../src/models';

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
    this.responses = Object.entries(invokeConfig.functions).map(
      ([k, v]: [string, any]) => ({
        functionName: v.name,
        response: fs
          .readFileSync(path.resolve(__dirname, `../../${v.mock}`))
          .toString(),
      }),
    );
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
  // eslint-disable-next-line
  public async invoke(
    params: InvocationRequest,
  ): Promise<InvocationResponse> {
    const mockFunction: IMockFunctions | undefined = LambdaMockService.responses.find(
      (item: IMockFunctions) => item.functionName === params.FunctionName,
    );
    if (!mockFunction) {
      const error: ServiceException = {
        $metadata: { httpStatusCode: 415 },
        name: 'UnsupportedMediaTypeException',
        message: 'Unsupported Media Type',
        $fault: 'client',
        $retryable: { throttling: false },
      };
      throw error;
    }
    const payload: any = mockFunction.response;

    const response: InvocationResponse = {
      StatusCode: 200,
      Payload: payload,
    };

    return response;
  }

  /**
   * Validates the invocation response
   * @param response - the invocation response
   */
  public validateInvocationResponse(
    response: InvocationResponse,
  ): Promise<any> {
    if (
      !response.Payload
      || response.Payload as unknown as string === ''
      || (response.StatusCode && response.StatusCode >= 400)
    ) {
      throw new Error(
        `Lambda invocation returned error: ${response.StatusCode} with empty payload.`,
      );
    }

    const payload: any = JSON.parse(response.Payload as unknown as string);

    if (!payload.body) {
      throw new Error(
        `Lambda invocation returned bad data: ${JSON.stringify(payload)}.`,
      );
    }

    return payload;
  }
}

export { LambdaMockService };
