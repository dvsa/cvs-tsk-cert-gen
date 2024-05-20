import { Inject, Service } from 'typedi';
import { toUint8Array } from '@smithy/util-utf8';
import { InvocationRequest } from '@aws-sdk/client-lambda';
import { ITrailerRegistration } from '../models/ITrailerRegistration';
import { ERRORS } from '../models/Enums';
import { HTTPError } from '../models/HTTPError';
import { IInvokeConfig } from '../models/IInvokeConfig';
import { Configuration } from '../utils/Configuration';
import { LambdaService } from '../services/LambdaService';

@Service()
export class TrailerRepository {
  private readonly config: Configuration;

  private readonly lambdaClient: LambdaService;

  constructor(@Inject() lambdaClient: LambdaService) {
    this.config = Configuration.getInstance();
    this.lambdaClient = lambdaClient;
  }

  /**
   * To fetch trailer registration
   * @param vin The vin of the trailer
   * @param make The make of the trailer
   * @returns A payload containing the TRN of the trailer and a boolean.
   */
  public async getTrailerRegistrationObject(vin: string, make: string) {
    const config: IInvokeConfig = this.config.getInvokeConfig();
    const invokeParams: InvocationRequest = {
      FunctionName: config.functions.trailerRegistration.name,
      InvocationType: 'RequestResponse',
      LogType: 'Tail',
      Payload: toUint8Array(JSON.stringify({
        httpMethod: 'GET',
        path: `/v1/trailers/${vin}`,
        pathParameters: {
          proxy: '/v1/trailers',
        },
        queryStringParameters: {
          make,
        },
      })),
    };
    const response = await this.lambdaClient.invoke(invokeParams);
    try {
      if (!response.Payload || Buffer.from(response.Payload).toString() === '') {
        throw new HTTPError(
          500,
          `${ERRORS.LAMBDA_INVOCATION_ERROR} ${response.StatusCode} ${ERRORS.EMPTY_PAYLOAD}`,
        );
      }
      const payload: any = JSON.parse(Buffer.from(response.Payload).toString());
      if (payload.statusCode === 404) {
        console.debug(`vinOrChassisWithMake not found ${vin + make}`);
        return { Trn: undefined, IsTrailer: true };
      }
      if (payload.statusCode >= 400) {
        throw new HTTPError(
          500,
          `${ERRORS.LAMBDA_INVOCATION_ERROR} ${payload.statusCode} ${payload.body}`,
        );
      }
      const trailerRegistration = JSON.parse(
        payload.body,
      ) as ITrailerRegistration;
      return { Trn: trailerRegistration.trn, IsTrailer: true };
    } catch (err) {
      console.error(
        `Error on fetching vinOrChassisWithMake ${vin + make}`,
        err,
      );
      throw err;
    }
  }
}