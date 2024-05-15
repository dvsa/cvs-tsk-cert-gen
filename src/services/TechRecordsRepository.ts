import { Inject, Service } from 'typedi';
import { toUint8Array } from '@smithy/util-utf8';
import { InvocationRequest } from '@aws-sdk/client-lambda';
import { IInvokeConfig } from '../models/IInvokeConfig';
import { Configuration } from '../utils/Configuration';
import { LambdaService } from './LambdaService';

@Service()
export class TechRecordsRepository {
  private readonly config: Configuration;

  private readonly lambdaClient: LambdaService;

  constructor(@Inject() lambdaClient: LambdaService) {
    this.config = Configuration.getInstance();
    this.lambdaClient = lambdaClient;
  }

  /**
   * Used to return a subset of technical record information.
   * @param searchIdentifier
   */
  public callSearchTechRecords = async (searchIdentifier: string) => {
    const config: IInvokeConfig = this.config.getInvokeConfig();
    const invokeParams: InvocationRequest = {
      FunctionName: config.functions.techRecordsSearch.name,
      InvocationType: 'RequestResponse',
      LogType: 'Tail',
      Payload: toUint8Array(JSON.stringify({
        httpMethod: 'GET',
        path: `/v3/technical-records/search/${searchIdentifier}?searchCriteria=systemNumber`,
        pathParameters: {
          searchIdentifier,
        },
      })),
    };

    try {
      const lambdaResponse = await this.lambdaClient.invoke(invokeParams);
      const res = await this.lambdaClient.validateInvocationResponse(lambdaResponse);
      return JSON.parse(res.body);
    } catch (e) {
      console.log('Error searching technical records');
      console.log(JSON.stringify(e));
      return undefined;
    }
  };
}
