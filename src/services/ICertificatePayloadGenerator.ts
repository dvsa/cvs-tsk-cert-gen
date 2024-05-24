import { CERTIFICATE_DATA } from '../models/Enums';
import { ITestResult } from '../models/ITestResult';

export interface ICertificatePayloadGenerator {
  initialise(type: CERTIFICATE_DATA, isWelsh: boolean): any;
  generate(testResult: ITestResult): any;
}
