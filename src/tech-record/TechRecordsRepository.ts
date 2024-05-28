import { Service } from 'typedi';
import { toUint8Array } from '@smithy/util-utf8';
import { InvocationRequest } from '@aws-sdk/client-lambda';
import { IInvokeConfig } from '../models/IInvokeConfig';
import { Configuration } from '../utils/Configuration';
import { LambdaService } from '../services/LambdaService';
import { TechRecordGet, TechRecordType, ISearchResult } from '../models/Types';

@Service()
export class TechRecordsRepository {
  private readonly config: Configuration = Configuration.getInstance();

  constructor(private lambdaClient: LambdaService) {
  }

  /**
   * Used to get a singular whole technical record.
   * @param systemNumber
   * @param createdTimestamp
   */
  public callGetTechRecords = async <T extends TechRecordGet['techRecord_vehicleType']>(systemNumber: string, createdTimestamp: string): Promise<TechRecordType<T> | undefined> => {
    const config: IInvokeConfig = this.config.getInvokeConfig();

    const invokeParams: InvocationRequest = {
      FunctionName: config.functions.techRecords.name,
      InvocationType: 'RequestResponse',
      LogType: 'Tail',
      Payload: toUint8Array(JSON.stringify({
        httpMethod: 'GET',
        path: `/v3/technical-records/${systemNumber}/${createdTimestamp}`,
        pathParameters: {
          systemNumber,
          createdTimestamp,
        },
      })),
    };

    try {
      const lambdaResponse = await this.lambdaClient.invoke(invokeParams);
      const res = this.lambdaClient.validateInvocationResponse(lambdaResponse);

      return JSON.parse(res.body);
    } catch (e) {
      console.log('Error in get technical record');
      console.log(JSON.stringify(e));
      return undefined;
    }
  };

  /**
   * Used to return a subset of technical record information.
   * @param searchIdentifier
   */
  public callSearchTechRecords = async (searchIdentifier: string): Promise<ISearchResult[]> => {
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
      const res = this.lambdaClient.validateInvocationResponse(lambdaResponse);

      return JSON.parse(res.body);
    } catch (e) {
      console.log('Error searching technical records');
      console.log(JSON.stringify(e));
      return [];
    }
  };
}
