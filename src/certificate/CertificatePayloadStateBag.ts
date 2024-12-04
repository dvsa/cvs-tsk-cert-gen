import { ITestResult } from '../models';
import { CERTIFICATE_DATA } from '../models/Enums';

export type CertificatePayloadStateBag = {
	type: CERTIFICATE_DATA;
	isWelsh: boolean;
	testResult: ITestResult;
};
