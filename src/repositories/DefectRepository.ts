import { Service } from 'typedi';
import { InvocationRequest, InvocationResponse } from '@aws-sdk/client-lambda';
import { toUint8Array } from '@smithy/util-utf8';
import { IDefectParent } from '../models/IDefectParent';
import { IInvokeConfig } from '../models/IInvokeConfig';
import { ERRORS } from '../models/Enums';
import { HTTPError } from '../models/HTTPError';
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
    let defects: IDefectParent[] = [];
    let retries = 0;
    while (retries < 3) {
      try {
        // eslint-disable-next-line
        const response: InvocationResponse = await this.lambdaClient.invoke(invokeParams);
        const payload: any = this.lambdaClient.validateInvocationResponse(response);
        const defectsParsed = JSON.parse(payload.body);

        if (!defectsParsed || defectsParsed.length === 0) {
          throw new HTTPError(400, `${ERRORS.LAMBDA_INVOCATION_BAD_DATA} ${JSON.stringify(payload)}.`);
        }
        defects = defectsParsed;
        return defects;
      } catch (error) {
        retries++;
        // eslint-disable-next-line
        console.error(`There was an error retrieving the welsh defect translations on attempt ${retries}: ${error}`);
      }
    }
    return defects;
  }
}
