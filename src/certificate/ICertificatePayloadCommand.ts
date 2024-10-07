import { ICertificatePayload } from '../models';
import { ITestResult } from '../models';
import { CERTIFICATE_DATA } from '../models/Enums';

export interface ICertificatePayloadCommand {
	initialise(type: CERTIFICATE_DATA, isWelsh: boolean): void;
	generate(testResult: ITestResult): Promise<ICertificatePayload>;
}
