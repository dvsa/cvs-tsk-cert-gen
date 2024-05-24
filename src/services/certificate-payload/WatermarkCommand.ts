import { Service } from 'typedi';
import { ICertificatePayload } from '../../models/ICertificatePayload';
import { ITestResult } from '../../models/ITestResult';
import { ICertificatePayloadCommand } from '../ICertificatePayloadCommand';
import { CERTIFICATE_DATA } from '../../models/Enums';

@Service()
export class WatermarkCommand implements ICertificatePayloadCommand {
  initialise(type: CERTIFICATE_DATA, isWelsh: boolean = false) {
  }

  public async generate(testResult: ITestResult): Promise<ICertificatePayload> {
    return {
      Watermark: process.env.BRANCH === 'prod' ? '' : 'NOT VALID'
    } as ICertificatePayload;
  }
}
