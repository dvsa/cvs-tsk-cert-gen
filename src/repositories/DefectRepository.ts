import { Service } from 'typedi';
import { InvocationRequest, InvocationResponse } from '@aws-sdk/client-lambda';
import { toUint8Array } from '@smithy/util-utf8';
import { IDefectParent } from '../models/IDefectParent';
import { IInvokeConfig } from '../models/IInvokeConfig';
import { Configuration } from '../utils/Configuration';
import { LambdaService } from '../services/LambdaService';

@Service()
export class DefectRepository {
  private readonly config: Configuration = Configuration.getInstance();

  constructor(private lambdaClient: LambdaService) {
  }

  /**
   * Method used to retrieve the Welsh translations for the certificates
   * @returns a list of defects
   */
  public async getDefectTranslations(): Promise<IDefectParent[]> {
    const config: IInvokeConfig = this.config.getInvokeConfig();
    const invokeParams: InvocationRequest = {
      FunctionName: config.functions.defects.name,
      InvocationType: 'RequestResponse',
      LogType: 'Tail',
      Payload: toUint8Array(JSON.stringify({
        httpMethod: 'GET',
        path: '/defects/',
      })),
    };

    const response: InvocationResponse = await this.lambdaClient.invoke(invokeParams);
    const payload: any = this.lambdaClient.validateInvocationResponse(response);
    return JSON.parse(payload.body);
  }
}
