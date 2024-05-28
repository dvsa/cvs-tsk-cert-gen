import { CERTIFICATE_DATA } from '../models/Enums';
import { ICertificatePayload } from '../models/ICertificatePayload';
import { ITestResult } from '../models/ITestResult';

export interface ICertificatePayloadCommand {
  initialise(type: CERTIFICATE_DATA, isWelsh: boolean): void;
  generate(testResult: ITestResult): Promise<ICertificatePayload>;
}
