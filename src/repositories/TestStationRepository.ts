import { Service } from 'typedi';
import { InvocationRequest, InvocationResponse } from '@aws-sdk/client-lambda';
import { toUint8Array } from '@smithy/util-utf8';
import { ITestStation } from '../models/ITestStations';
import { IInvokeConfig } from '../models/IInvokeConfig';
import { HTTPError } from '../models/HTTPError';
import { ERRORS } from '../models/Enums';
import { LambdaService } from '../services/LambdaService';
import { Configuration } from '../utils/Configuration';

@Service()
export class TestStationRepository {
  private readonly config: Configuration = Configuration.getInstance();

  constructor(private lambdaClient: LambdaService) {
  }

  /**
   * Method to retrieve Test Station details from API
   * @returns list of test stations
   */
  public async getTestStations(): Promise<ITestStation[]> {
    const config: IInvokeConfig = this.config.getInvokeConfig();
    const invokeParams: InvocationRequest = {
      FunctionName: config.functions.testStations.name,
      InvocationType: 'RequestResponse',
      LogType: 'Tail',
      Payload: toUint8Array(JSON.stringify({
        httpMethod: 'GET',
        path: '/test-stations/',
      })),
    };

    let testStations: ITestStation[] = [];
    let retries = 0;

    while (retries < 3) {
      try {
        // eslint-disable-next-line
        const response: InvocationResponse = await this.lambdaClient.invoke(invokeParams);
        const payload: any = this.lambdaClient.validateInvocationResponse(response);
        const testStationsParsed = JSON.parse(payload.body);

        if (!testStationsParsed || testStationsParsed.length === 0) {
          throw new HTTPError(400, `${ERRORS.LAMBDA_INVOCATION_BAD_DATA} ${JSON.stringify(payload)}.`);
        }

        testStations = testStationsParsed;

        return testStations;
      } catch (error) {
        retries++;
        // eslint-disable-next-line
        console.error(`There was an error retrieving the test stations on attempt ${retries}: ${error}`);
      }
    }
    return testStations;
  }
}
