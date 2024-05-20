import { ITestResult } from '../models/ITestResult';

export interface ICertificatePayloadGenerator {
  generate(testResult: ITestResult): any;
}
