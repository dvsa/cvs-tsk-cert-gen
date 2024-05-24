import { Service } from 'typedi';
import { ICertificatePayload } from '../../models/ICertificatePayload';
import { ITestResult } from '../../models/ITestResult';
import { ICertificatePayloadGenerator } from '../ICertificatePayloadGenerator';
import { CERTIFICATE_DATA } from '../../models/Enums';

@Service()
export class WatermarkCommand implements ICertificatePayloadGenerator {
  initialise(type: CERTIFICATE_DATA, isWelsh: boolean = false) {
  }

  public async generate(testResult: ITestResult): Promise<ICertificatePayload> {
    return {
      Watermark: process.env.BRANCH === 'prod' ? '' : 'NOT VALID'
    } as ICertificatePayload;
  }
}
