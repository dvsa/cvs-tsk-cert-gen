import { Inject, Service } from 'typedi';
import { toUint8Array } from '@smithy/util-utf8';
import { InvocationRequest } from '@aws-sdk/client-lambda';
import { IInvokeConfig } from '../models/IInvokeConfig';
import { Configuration } from '../utils/Configuration';
import { LambdaService } from './LambdaService';
import { ISearchResult, TechRecordGet, TechRecordType } from '../models/Types';

@Service()
export class TechRecordsRepository {
  private readonly config: Configuration;

  private readonly lambdaClient: LambdaService;

  constructor(@Inject() lambdaClient: LambdaService) {
    this.config = Configuration.getInstance();
    this.lambdaClient = lambdaClient;
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
      const res = await this.lambdaClient.validateInvocationResponse(lambdaResponse);
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

  public processGetCurrentProvisionalRecords = async <T extends TechRecordGet['techRecord_vehicleType']>(searchResult: ISearchResult[]): Promise<TechRecordType<T> | undefined> => {
    if (searchResult) {
      const processRecordsRes = this.groupRecordsByStatusCode(searchResult);

      if (processRecordsRes.currentCount !== 0) {
        return this.callGetTechRecords(
          processRecordsRes.currentRecords[0].systemNumber,
          processRecordsRes.currentRecords[0].createdTimestamp,
        );
      }

      if (processRecordsRes.provisionalCount === 1) {
        return this.callGetTechRecords(
          processRecordsRes.provisionalRecords[0].systemNumber,
          processRecordsRes.provisionalRecords[0].createdTimestamp,
        );
      }

      return this.callGetTechRecords(
        processRecordsRes.provisionalRecords[1].systemNumber,
        processRecordsRes.provisionalRecords[1].createdTimestamp,
      );
    }

    return Promise.reject(new Error('Tech record Search returned nothing.'));
  };

  /**
   * helper function is used to process records and count provisional and current records
   * @param records
   */
  private groupRecordsByStatusCode = (records: ISearchResult[]): { currentRecords: ISearchResult[]; provisionalRecords: ISearchResult[]; currentCount: number; provisionalCount: number; } => {
    const currentRecords: ISearchResult[] = [];
    const provisionalRecords: ISearchResult[] = [];
    records.forEach((record) => {
      if (record.techRecord_statusCode === 'current') {
        currentRecords.push(record);
      } else if (record.techRecord_statusCode === 'provisional') {
        provisionalRecords.push(record);
      }
    });

    return {
      currentRecords,
      provisionalRecords,
      currentCount: currentRecords.length,
      provisionalCount: provisionalRecords.length,
    };
  };
}
