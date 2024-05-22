import { Service } from 'typedi';
import { ServiceException } from '@smithy/smithy-client';
import { InvocationRequest, InvocationResponse, LambdaClient } from '@aws-sdk/client-lambda';
import * as fs from 'fs';
import * as path from 'path';
import { Configuration } from '../../src/utils/Configuration';
import { IInvokeConfig } from '../../src/models/IInvokeConfig';
import { LambdaService } from '../../src/services/LambdaService';

interface IMockFunctions {
  functionName: string;
  response: string;
}

/**
 * Service for mocking the LambdaService
 */
@Service()
class LambdaMockService extends LambdaService {
  private static responses: IMockFunctions[] = [];

  constructor(lambdaClient: LambdaClient = {} as LambdaClient) {
    super(lambdaClient);
  }

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
}

export { LambdaMockService };
