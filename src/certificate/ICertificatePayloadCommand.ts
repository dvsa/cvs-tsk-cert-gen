import { CERTIFICATE_DATA } from '../models/Enums';
import { ITestResult } from '../models/ITestResult';

export interface ICertificatePayloadCommand {
  initialise(type: CERTIFICATE_DATA, isWelsh: boolean): any;
  generate(testResult: ITestResult): any;
}
